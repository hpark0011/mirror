/// <reference types="vite/client" />

// Tool internal queries — `queryLatestPublished` and `resolveBySlug`.
//
// These queries are the server-side data primitives that power
// `chat/tools.ts:buildCloneTools`. The cross-user isolation invariant
// (`.claude/rules/embeddings.md`) extends from RAG to actions: the
// LLM-visible `inputSchema` for each tool MUST NOT include `userId`, so the
// only way the tool can resolve a row is by passing its closure-bound
// `profileOwnerId` to these internal queries. If `resolveBySlug` ever
// returned a row whose `userId` did not match the queried `userId`, an
// agent could be tricked into navigating across users.

process.env.SITE_URL = process.env.SITE_URL ?? "https://test.local";
process.env.GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ?? "test-google-client-id";
process.env.GOOGLE_CLIENT_SECRET =
  process.env.GOOGLE_CLIENT_SECRET ?? "test-google-client-secret";

import { describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../schema";

vi.mock("@convex-dev/agent", () => {
  return {
    createThread: vi.fn(async () => "thread_x"),
    saveMessage: vi.fn(async () => ({ messageId: "msg_x" })),
    listMessages: vi.fn(async () => ({
      page: [],
      isDone: true,
      continueCursor: "",
    })),
    Agent: class {
      async continueThread() {
        return {
          thread: { streamText: vi.fn(async () => undefined) },
        };
      }
    },
    createTool: vi.fn((def: unknown) => def),
  };
});

vi.mock("ai", () => {
  return {
    embed: vi.fn(async () => ({
      embedding: new Array(768).fill(0.01),
    })),
    embedMany: vi.fn(async ({ values }: { values: string[] }) => ({
      embeddings: values.map(() => new Array(768).fill(0.01)),
    })),
  };
});

vi.mock("@ai-sdk/google", () => {
  return {
    google: {
      textEmbeddingModel: vi.fn(() => ({})),
    },
  };
});

vi.mock("../../auth/client", () => {
  return {
    authComponent: {
      safeGetAuthUser: vi.fn(async () => null),
      getAuthUser: vi.fn(async () => null),
    },
  };
});

import { internal } from "../../_generated/api";
import { buildCloneTools } from "../tools";
import { buildContentHref } from "../toolQueries";
import {
  findRelevantPublishedContent,
  type RelevantContentSearchCtx,
} from "../relevantContent";
import { buildBioHref } from "../../content/href";
import {
  CONTENT_SOURCES,
  NAVIGABLE_CONTENT_SOURCES,
} from "../../content/sourceRegistry";
import { buildEmbeddingUserSourceKey } from "../../embeddings/schema";
import { normalizeConvexGlob } from "./testUtils";
import { type Id } from "../../_generated/dataModel";

const rawModules = import.meta.glob("../../**/*.{ts,js}");
const modules = normalizeConvexGlob(rawModules);

function makeT() {
  return convexTest(schema, modules);
}

async function insertOwner(t: ReturnType<typeof makeT>, name: string) {
  return t.run(async (ctx) =>
    ctx.db.insert("users", {
      authId: `auth_${name}`,
      email: `${name}@example.com`,
      username: name,
      onboardingComplete: true,
    }),
  );
}

describe("chat/toolQueries.queryLatestPublished", () => {
  it("returns the most recent published article for the user (and ignores drafts)", async () => {
    const t = makeT();
    const owner = await insertOwner(t, "owner_latest");

    // Older published article + newer draft + middle published article.
    // Expectation: returns the middle published (newest published), NOT the
    // newer draft.
    const olderPublished = await t.run(async (ctx) => {
      const id = await ctx.db.insert("articles", {
        userId: owner,
        slug: "older-published",
        title: "Older Published",
        category: "blog",
        body: { type: "doc", content: [] },
        status: "published",
        publishedAt: 1000,
        createdAt: 1000,
      });
      return id;
    });
    const middlePublished = await t.run(async (ctx) => {
      const id = await ctx.db.insert("articles", {
        userId: owner,
        slug: "middle-published",
        title: "Middle Published",
        category: "blog",
        body: { type: "doc", content: [] },
        status: "published",
        publishedAt: 2000,
        createdAt: 2000,
      });
      return id;
    });
    const _newerDraft = await t.run(async (ctx) => {
      const id = await ctx.db.insert("articles", {
        userId: owner,
        slug: "newer-draft",
        title: "Newer Draft",
        category: "blog",
        body: { type: "doc", content: [] },
        status: "draft",
        createdAt: 3000,
      });
      return id;
    });

    const result = await t.query(
      internal.chat.toolQueries.queryLatestPublished,
      { userId: owner, kind: "articles" },
    );

    expect(result).not.toBeNull();
    expect(result!.slug).toBe("middle-published");
    expect(result!.title).toBe("Middle Published");
    expect(result!.publishedAt).toBe(2000);
    // Sanity — we did insert these.
    expect(olderPublished).not.toBe(middlePublished);
  });

  it("orders latest by publishedAt, not row creation time", async () => {
    const t = makeT();
    const owner = await insertOwner(t, "owner_publish_time");

    // Insert the semantically newest publication first. A `_creationTime`
    // ordered query would incorrectly return the second row below.
    await t.run(async (ctx) =>
      ctx.db.insert("articles", {
        userId: owner,
        slug: "published-later",
        title: "Published Later",
        category: "blog",
        body: { type: "doc", content: [] },
        status: "published",
        publishedAt: 3000,
        createdAt: 1000,
      }),
    );
    await t.run(async (ctx) =>
      ctx.db.insert("articles", {
        userId: owner,
        slug: "created-later",
        title: "Created Later",
        category: "blog",
        body: { type: "doc", content: [] },
        status: "published",
        publishedAt: 2000,
        createdAt: 2000,
      }),
    );

    const result = await t.query(
      internal.chat.toolQueries.queryLatestPublished,
      { userId: owner, kind: "articles" },
    );

    expect(result).not.toBeNull();
    expect(result!.slug).toBe("published-later");
    expect(result!.publishedAt).toBe(3000);
  });

  it("returns null when the user has zero published items of that kind", async () => {
    const t = makeT();
    const owner = await insertOwner(t, "owner_no_published");

    // Only a draft — must NOT count as the latest.
    await t.run(async (ctx) =>
      ctx.db.insert("articles", {
        userId: owner,
        slug: "only-draft",
        title: "Only Draft",
        category: "blog",
        body: { type: "doc", content: [] },
        status: "draft",
        createdAt: 1000,
      }),
    );

    const result = await t.query(
      internal.chat.toolQueries.queryLatestPublished,
      { userId: owner, kind: "articles" },
    );

    expect(result).toBeNull();
  });

  it("returns null for a user with no rows at all", async () => {
    const t = makeT();
    const owner = await insertOwner(t, "owner_empty");

    const result = await t.query(
      internal.chat.toolQueries.queryLatestPublished,
      { userId: owner, kind: "posts" },
    );

    expect(result).toBeNull();
  });

  it("PERF: returns the published row in <50ms when surrounded by 50 drafts", async () => {
    // Regression guard for FG_125. The previous shape walked `by_userId` in
    // descending order and skipped drafts in a `for await` loop — so a user
    // with N drafts ahead of any published row read N documents per call.
    // The compound `by_userId_status_publishedAt` index pins the scan to
    // published rows and orders by the semantic publish timestamp, so the
    // latency is bounded regardless of draft count.
    //
    // The convex-test harness has no first-class "documents-read" counter,
    // so we assert latency. The threshold is generous (<50ms) on top of an
    // in-memory store with 50 drafts; pre-fix this same shape walked all 50
    // drafts in O(N) which still passes locally but blows up at scale on
    // production-sized tables. The real value of this test is locking the
    // `.first()` shape — if a future edit reverts to the iterator/skip
    // pattern it will at least flag in slower CI runs and certainly in any
    // future "documents-read" assertion. The skip-loop revert is also caught
    // by the criterion's grep on `.filter(` inside the function bodies.
    const t = makeT();
    const owner = await insertOwner(t, "owner_perf");

    // Insert 50 drafts. Mix of older and newer creationTime values so the
    // test exercises the descending-order path: if `.first()` quietly
    // changed to ascending it would still return the published row, but the
    // assertion below pins the exact slug.
    await t.run(async (ctx) => {
      for (let i = 0; i < 50; i++) {
        await ctx.db.insert("articles", {
          userId: owner,
          slug: `draft-${i}`,
          title: `Draft ${i}`,
          category: "blog",
          body: { type: "doc", content: [] },
          status: "draft",
          createdAt: 1000 + i,
        });
      }
    });

    // One published row — the only row the new index sees.
    await t.run(async (ctx) =>
      ctx.db.insert("articles", {
        userId: owner,
        slug: "the-one-published",
        title: "The One Published",
        category: "blog",
        body: { type: "doc", content: [] },
        status: "published",
        publishedAt: 9999,
        createdAt: 9999,
      }),
    );

    const start = performance.now();
    const result = await t.query(
      internal.chat.toolQueries.queryLatestPublished,
      { userId: owner, kind: "articles" },
    );
    const elapsedMs = performance.now() - start;

    expect(result).not.toBeNull();
    expect(result!.slug).toBe("the-one-published");
    expect(result!.title).toBe("The One Published");
    // Latency bound. Convex-test runs in-memory so even the buggy O(N)
    // shape would pass on 50 rows locally — the real protection is the
    // `.filter()` grep in the acceptance criteria. This bound mostly
    // guards against an accidental `.collect()` or full-table walk.
    expect(elapsedMs).toBeLessThan(50);
  });
});

describe("chat/toolQueries.resolveBySlug", () => {
  it("returns the row when slug + user + published status all match", async () => {
    const t = makeT();
    const owner = await insertOwner(t, "owner_resolve");

    await t.run(async (ctx) =>
      ctx.db.insert("articles", {
        userId: owner,
        slug: "hello-world",
        title: "Hello World",
        category: "blog",
        body: { type: "doc", content: [] },
        status: "published",
        publishedAt: 1234,
        createdAt: 1234,
      }),
    );

    const result = await t.query(internal.chat.toolQueries.resolveBySlug, {
      userId: owner,
      kind: "articles",
      slug: "hello-world",
    });

    expect(result).not.toBeNull();
    expect(result!.kind).toBe("articles");
    expect(result!.slug).toBe("hello-world");
    expect(result!.title).toBe("Hello World");
    expect(result!.publishedAt).toBe(1234);
    expect(result!.username).toBe("owner_resolve");
    // The server builds the canonical href once (via `buildContentHref`) so a
    // typo in the URL template surfaces here, not as a silent 404 in the
    // visitor's browser. Format: `/@<username>/<kind>/<slug>`.
    expect(result!.href).toBe("/@owner_resolve/articles/hello-world");
  });

  it("returns null for a draft (status !== published)", async () => {
    const t = makeT();
    const owner = await insertOwner(t, "owner_draft");

    await t.run(async (ctx) =>
      ctx.db.insert("articles", {
        userId: owner,
        slug: "secret-draft",
        title: "Secret Draft",
        category: "blog",
        body: { type: "doc", content: [] },
        status: "draft",
        createdAt: 1000,
      }),
    );

    const result = await t.query(internal.chat.toolQueries.resolveBySlug, {
      userId: owner,
      kind: "articles",
      slug: "secret-draft",
    });

    expect(result).toBeNull();
  });

  it("SECURITY: returns null when the slug is owned by a DIFFERENT user", async () => {
    // Cross-user isolation invariant. User A's clone agent must NOT be able
    // to navigate to User B's slug just because B published something with
    // the same slug. This is the same `userId`-pinned filter the RAG side
    // uses; if it ever loosens, the agent can leak across users.
    const t = makeT();
    const userA = await insertOwner(t, "user_a_resolve");
    const userB = await insertOwner(t, "user_b_resolve");

    // User B publishes an article. User A's clone must not be able to open
    // it through `resolveBySlug({ userId: userA, slug: <B's slug> })`.
    await t.run(async (ctx) =>
      ctx.db.insert("articles", {
        userId: userB,
        slug: "b-only-article",
        title: "B's Article",
        category: "blog",
        body: { type: "doc", content: [] },
        status: "published",
        publishedAt: 2000,
        createdAt: 2000,
      }),
    );

    const crossUserResult = await t.query(
      internal.chat.toolQueries.resolveBySlug,
      { userId: userA, kind: "articles", slug: "b-only-article" },
    );

    expect(crossUserResult).toBeNull();

    // Positive control — proves the row WAS actually inserted, so the null
    // above is a real cross-user rejection rather than a "test passes for
    // the wrong reason" empty-table case. User B querying their own slug
    // must succeed and return the canonical href.
    const sameUserResult = await t.query(
      internal.chat.toolQueries.resolveBySlug,
      { userId: userB, kind: "articles", slug: "b-only-article" },
    );

    expect(sameUserResult).not.toBeNull();
    expect(sameUserResult!.username).toBe("user_b_resolve");
    expect(sameUserResult!.href).toBe(
      "/@user_b_resolve/articles/b-only-article",
    );
  });

  it("returns null for a slug that does not exist for the user", async () => {
    const t = makeT();
    const owner = await insertOwner(t, "owner_missing");

    const result = await t.query(internal.chat.toolQueries.resolveBySlug, {
      userId: owner,
      kind: "posts",
      slug: "nonexistent",
    });

    expect(result).toBeNull();
  });

  it("scopes posts independently from articles (same slug across kinds)", async () => {
    // Defensive: an article and a post with the same slug exist for the
    // same user. Each kind resolves its own row — no leakage between
    // tables.
    const t = makeT();
    const owner = await insertOwner(t, "owner_kinds");

    await t.run(async (ctx) =>
      ctx.db.insert("articles", {
        userId: owner,
        slug: "shared-slug",
        title: "An Article",
        category: "blog",
        body: { type: "doc", content: [] },
        status: "published",
        publishedAt: 1000,
        createdAt: 1000,
      }),
    );
    await t.run(async (ctx) =>
      ctx.db.insert("posts", {
        userId: owner,
        slug: "shared-slug",
        title: "A Post",
        category: "general",
        body: { type: "doc", content: [] },
        status: "published",
        publishedAt: 2000,
        createdAt: 2000,
      }),
    );

    const articleResult = await t.query(
      internal.chat.toolQueries.resolveBySlug,
      { userId: owner, kind: "articles", slug: "shared-slug" },
    );
    const postResult = await t.query(internal.chat.toolQueries.resolveBySlug, {
      userId: owner,
      kind: "posts",
      slug: "shared-slug",
    });

    expect(articleResult!.title).toBe("An Article");
    expect(postResult!.title).toBe("A Post");
  });

  it("scopes resolveBySlug to userId when the same slug exists for multiple users", async () => {
    // Strongest shape for the compound-index scoping invariant: same slug,
    // two users, both published. Each user must get their own row. A
    // regression that drops the userId clause from the by_userId_and_slug
    // index would either throw (.unique() on two rows) or return the wrong
    // row — both outcomes fail this test loudly.
    const t = makeT();
    const userA = await insertOwner(t, "user_a_collision");
    const userB = await insertOwner(t, "user_b_collision");

    await t.run(async (ctx) =>
      ctx.db.insert("articles", {
        userId: userA,
        slug: "shared-slug",
        title: "User A's article",
        category: "blog",
        body: { type: "doc", content: [] },
        status: "published",
        publishedAt: 1000,
        createdAt: 1000,
      }),
    );
    await t.run(async (ctx) =>
      ctx.db.insert("articles", {
        userId: userB,
        slug: "shared-slug",
        title: "User B's article",
        category: "blog",
        body: { type: "doc", content: [] },
        status: "published",
        publishedAt: 2000,
        createdAt: 2000,
      }),
    );

    const aResult = await t.query(internal.chat.toolQueries.resolveBySlug, {
      userId: userA,
      kind: "articles",
      slug: "shared-slug",
    });
    expect(aResult).not.toBeNull();
    expect(aResult!.username).toBe("user_a_collision");
    expect(aResult!.title).toBe("User A's article");
    expect(aResult!.href).toBe("/@user_a_collision/articles/shared-slug");

    const bResult = await t.query(internal.chat.toolQueries.resolveBySlug, {
      userId: userB,
      kind: "articles",
      slug: "shared-slug",
    });
    expect(bResult).not.toBeNull();
    expect(bResult!.username).toBe("user_b_collision");
    expect(bResult!.title).toBe("User B's article");
    expect(bResult!.href).toBe("/@user_b_collision/articles/shared-slug");
  });
});

describe("chat/toolQueries.resolvePublishedContentCandidates", () => {
  it("returns published candidates in the input ranking order", async () => {
    const t = makeT();
    const owner = await insertOwner(t, "owner_relevant_order");

    const ids = await t.run(async (ctx) => {
      const second = await ctx.db.insert("articles", {
        userId: owner,
        slug: "second-ranked",
        title: "Second Ranked",
        category: "blog",
        body: { type: "doc", content: [] },
        status: "published",
        publishedAt: 1000,
        createdAt: 1000,
      });
      const first = await ctx.db.insert("articles", {
        userId: owner,
        slug: "first-ranked",
        title: "First Ranked",
        category: "blog",
        body: { type: "doc", content: [] },
        status: "published",
        publishedAt: 2000,
        createdAt: 2000,
      });
      return { first, second };
    });

    const result = await t.query(
      internal.chat.toolQueries.resolvePublishedContentCandidates,
      {
        userId: owner,
        candidates: [
          {
            kind: "articles",
            sourceId: ids.first,
            slug: "first-ranked",
            score: 0.91,
            excerpt: "best excerpt",
          },
          {
            kind: "articles",
            sourceId: ids.second,
            slug: "second-ranked",
            score: 0.88,
            excerpt: "second excerpt",
          },
        ],
      },
    );

    expect(result.map((row) => row.slug)).toEqual([
      "first-ranked",
      "second-ranked",
    ]);
    expect(result[0]).toMatchObject({
      kind: "articles",
      title: "First Ranked",
      href: buildContentHref(
        "owner_relevant_order",
        "articles",
        "first-ranked",
      ),
      excerpt: "best excerpt",
      score: 0.91,
    });
  });

  it("resolves candidates by source id and returns the row's current slug", async () => {
    const t = makeT();
    const owner = await insertOwner(t, "owner_relevant_renamed");

    const ids = await t.run(async (ctx) => {
      const renamed = await ctx.db.insert("articles", {
        userId: owner,
        slug: "current-slug",
        title: "Renamed Article",
        category: "blog",
        body: { type: "doc", content: [] },
        status: "published",
        publishedAt: 1000,
        createdAt: 1000,
      });
      const reusedOldSlug = await ctx.db.insert("articles", {
        userId: owner,
        slug: "old-slug",
        title: "Different Article Reusing Old Slug",
        category: "blog",
        body: { type: "doc", content: [] },
        status: "published",
        publishedAt: 2000,
        createdAt: 2000,
      });
      return { renamed, reusedOldSlug };
    });

    const result = await t.query(
      internal.chat.toolQueries.resolvePublishedContentCandidates,
      {
        userId: owner,
        candidates: [
          {
            kind: "articles",
            sourceId: ids.renamed,
            slug: "old-slug",
            score: 0.96,
            excerpt: "stale slug excerpt",
          },
        ],
      },
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      kind: "articles",
      slug: "current-slug",
      title: "Renamed Article",
      href: buildContentHref(
        "owner_relevant_renamed",
        "articles",
        "current-slug",
      ),
      excerpt: "stale slug excerpt",
      score: 0.96,
    });
    expect(result[0]!.title).not.toBe("Different Article Reusing Old Slug");
    expect(ids.reusedOldSlug).toBeDefined();
  });

  it("excludes drafts even when a stale embedding candidate names the slug", async () => {
    const t = makeT();
    const owner = await insertOwner(t, "owner_relevant_draft");

    const draftId = await t.run(async (ctx) =>
      ctx.db.insert("articles", {
        userId: owner,
        slug: "draft-match",
        title: "Draft Match",
        category: "blog",
        body: { type: "doc", content: [] },
        status: "draft",
        createdAt: 1000,
      }),
    );

    const result = await t.query(
      internal.chat.toolQueries.resolvePublishedContentCandidates,
      {
        userId: owner,
        candidates: [
          {
            kind: "articles",
            sourceId: draftId,
            slug: "draft-match",
            score: 0.99,
            excerpt: "draft excerpt",
          },
        ],
      },
    );

    expect(result).toEqual([]);
  });

  it("excludes cross-user candidates with the same slug", async () => {
    const t = makeT();
    const userA = await insertOwner(t, "relevant_user_a");
    const userB = await insertOwner(t, "relevant_user_b");

    const userBArticleId = await t.run(async (ctx) =>
      ctx.db.insert("articles", {
        userId: userB,
        slug: "shared-topic",
        title: "B's Article",
        category: "blog",
        body: { type: "doc", content: [] },
        status: "published",
        publishedAt: 1000,
        createdAt: 1000,
      }),
    );

    const result = await t.query(
      internal.chat.toolQueries.resolvePublishedContentCandidates,
      {
        userId: userA,
        candidates: [
          {
            kind: "articles",
            sourceId: userBArticleId,
            slug: "shared-topic",
            score: 0.94,
            excerpt: "cross user excerpt",
          },
        ],
      },
    );

    expect(result).toEqual([]);
  });

  it("scopes the same slug independently across articles and posts", async () => {
    const t = makeT();
    const owner = await insertOwner(t, "owner_relevant_kinds");

    const ids = await t.run(async (ctx) => {
      const article = await ctx.db.insert("articles", {
        userId: owner,
        slug: "shared-slug",
        title: "Shared Article",
        category: "blog",
        body: { type: "doc", content: [] },
        status: "published",
        publishedAt: 1000,
        createdAt: 1000,
      });
      const post = await ctx.db.insert("posts", {
        userId: owner,
        slug: "shared-slug",
        title: "Shared Post",
        category: "general",
        body: { type: "doc", content: [] },
        status: "published",
        publishedAt: 2000,
        createdAt: 2000,
      });
      return { article, post };
    });

    const result = await t.query(
      internal.chat.toolQueries.resolvePublishedContentCandidates,
      {
        userId: owner,
        candidates: [
          {
            kind: "posts",
            sourceId: ids.post,
            slug: "shared-slug",
            score: 0.93,
            excerpt: "post excerpt",
          },
          {
            kind: "articles",
            sourceId: ids.article,
            slug: "shared-slug",
            score: 0.9,
            excerpt: "article excerpt",
          },
        ],
      },
    );

    expect(result.map((row) => row.title)).toEqual([
      "Shared Post",
      "Shared Article",
    ]);
    expect(result.map((row) => row.href)).toEqual([
      buildContentHref("owner_relevant_kinds", "posts", "shared-slug"),
      buildContentHref("owner_relevant_kinds", "articles", "shared-slug"),
    ]);
  });
});

describe("chat/relevantContent.findRelevantPublishedContent", () => {
  type CapturedVectorQuery = {
    limit?: number;
    filter?: (q: {
      eq: (fieldName: string, value: unknown) => unknown;
    }) => unknown;
  };
  type CapturedVectorResult = {
    _id: Id<"contentEmbeddings">;
    _score: number;
  };

  function makeRelevantContentCtx(
    vectorResultsByCall: CapturedVectorResult[][] = [],
  ) {
    const capturedQueries: CapturedVectorQuery[] = [];
    const runQuery = vi.fn();
    const vectorSearch = vi.fn(
      async (
        _tableName: string,
        _indexName: string,
        query: CapturedVectorQuery,
      ) => {
        capturedQueries.push(query);
        return vectorResultsByCall[capturedQueries.length - 1] ?? [];
      },
    );

    return {
      ctx: {
        runQuery,
        vectorSearch,
      } as unknown as RelevantContentSearchCtx,
      getCapturedQueries: () => capturedQueries,
    };
  }

  it("uses the composite owner+source filter for kind-restricted vector search", async () => {
    const owner = "users_owner_kind_filter" as Id<"users">;
    const { ctx, getCapturedQueries } = makeRelevantContentCtx();

    await findRelevantPublishedContent(ctx, {
      profileOwnerId: owner,
      query: "greyboard ai",
      kind: "articles",
    });

    const [query] = getCapturedQueries();
    expect(query).toBeDefined();
    expect(query!.limit).toBe(16);

    const eq = vi.fn((fieldName: string, value: unknown) => ({
      fieldName,
      value,
    }));
    expect(query!.filter?.({ eq })).toEqual({
      fieldName: "userSourceKey",
      value: buildEmbeddingUserSourceKey(owner, "articles"),
    });
    expect(eq).toHaveBeenCalledTimes(1);
  });

  it("falls back to owner-only vector search for legacy kind embeddings", async () => {
    const owner = "users_owner_legacy_filter" as Id<"users">;
    const { ctx, getCapturedQueries } = makeRelevantContentCtx();

    await findRelevantPublishedContent(ctx, {
      profileOwnerId: owner,
      query: "greyboard ai",
      kind: "articles",
    });

    const [, legacyQuery] = getCapturedQueries();
    expect(legacyQuery).toBeDefined();
    expect(legacyQuery!.limit).toBe(256);

    const eq = vi.fn((fieldName: string, value: unknown) => ({
      fieldName,
      value,
    }));
    expect(legacyQuery!.filter?.({ eq })).toEqual({
      fieldName: "userId",
      value: owner,
    });
    expect(eq).toHaveBeenCalledTimes(1);
  });

  it("keeps the owner-only filter for unrestricted relevant-content search", async () => {
    const owner = "users_owner_general_filter" as Id<"users">;
    const { ctx, getCapturedQueries } = makeRelevantContentCtx();

    await findRelevantPublishedContent(ctx, {
      profileOwnerId: owner,
      query: "greyboard ai",
    });

    const [query] = getCapturedQueries();
    expect(query).toBeDefined();
    expect(getCapturedQueries()).toHaveLength(1);

    const eq = vi.fn((fieldName: string, value: unknown) => ({
      fieldName,
      value,
    }));
    expect(query!.filter?.({ eq })).toEqual({
      fieldName: "userId",
      value: owner,
    });
    expect(eq).toHaveBeenCalledTimes(1);
  });

  it("excludes every non-navigable registry source from relevant-content navigation candidates", async () => {
    const owner = "users_owner_non_nav" as Id<"users">;
    const nonNavigableSources = CONTENT_SOURCES.filter(
      (source) => !source.navigation.navigable,
    );
    expect(nonNavigableSources.length).toBeGreaterThan(0);

    const vectorResults = nonNavigableSources.map((source, index) => ({
      _id: `contentEmbeddings_${source.sourceTable}_${index}` as Id<"contentEmbeddings">,
      _score: 0.95,
    }));
    const { ctx } = makeRelevantContentCtx([vectorResults]);
    const runQuery = ctx.runQuery as unknown as ReturnType<typeof vi.fn>;
    runQuery.mockResolvedValueOnce(
      nonNavigableSources.map((source, index) => ({
        id: vectorResults[index]!._id,
        sourceTable: source.sourceTable,
        sourceId: `${source.sourceTable}_${index}`,
        title: source.label.singular,
        slug: "should-not-open",
        chunkText: "Ambient context only.",
      })),
    );

    const result = await findRelevantPublishedContent(ctx, {
      profileOwnerId: owner,
      query: "background",
    });

    expect(result).toEqual([]);
    expect(runQuery).toHaveBeenCalledTimes(1);
  });
});

describe("chat/tools.buildCloneTools — inputSchema invariants", () => {
  // The cross-user isolation contract (`.claude/rules/embeddings.md`) hinges
  // on the LLM-visible `inputSchema` not exposing any user identifier — the
  // factory closes over `profileOwnerId` server-side. A future edit that
  // adds `userId: z.id("users")` (or any synonym) to either tool's
  // `inputSchema` lets the model pass an arbitrary user id and breaks the
  // boundary. The plan's verification list (§Verification, item 1) calls
  // this out explicitly: "tool args validator rejects userId."
  //
  // We assert on schema keys (not stringified _def) so that a tool
  // description string mentioning the word "userId" (e.g. "do not pass
  // userId") does not false-positive. Description strings are NOT the trust
  // boundary; schema keys are.

  // Walk a Zod object shape recursively and collect all field keys.
  // Catches user-identifier leaks at any nesting depth (e.g. a future
  // z.discriminatedUnion whose variant contains `userId`).
  function collectAllKeys(shape: Record<string, unknown>): string[] {
    const keys: string[] = [];
    for (const [k, v] of Object.entries(shape)) {
      keys.push(k);
      // If v is a Zod object, recurse into its shape.
      const nestedShape = (v as { shape?: Record<string, unknown> })?.shape;
      if (nestedShape) keys.push(...collectAllKeys(nestedShape));
    }
    return keys;
  }

  const fakeOwner = "users_fake_owner_id" as unknown as Id<"users">;

  it("getLatestPublished.inputSchema does not expose userId (or any user identifier)", () => {
    const tools = buildCloneTools(fakeOwner);
    const schema = tools.getLatestPublished.inputSchema as
      | { shape?: Record<string, unknown> }
      | undefined;

    expect(schema).toBeDefined();
    // Direct shape check — works with Zod v4's `z.object({...}).shape`.
    expect(schema!.shape).toBeDefined();
    expect("userId" in schema!.shape!).toBe(false);
    expect("user_id" in schema!.shape!).toBe(false);
    expect("ownerId" in schema!.shape!).toBe(false);

    // Defense-in-depth: description strings are not the trust boundary;
    // schema keys are. Walk every key at every nesting depth.
    const allKeys = collectAllKeys(schema!.shape!);
    expect(allKeys.every((k) => !/^(userId|user_id|ownerId)$/i.test(k))).toBe(
      true,
    );
  });

  it("navigateToContent.inputSchema does not expose userId (or any user identifier)", () => {
    const tools = buildCloneTools(fakeOwner);
    const schema = tools.navigateToContent.inputSchema as
      | { shape?: Record<string, unknown> }
      | undefined;

    expect(schema).toBeDefined();
    expect(schema!.shape).toBeDefined();
    expect("userId" in schema!.shape!).toBe(false);
    expect("user_id" in schema!.shape!).toBe(false);
    expect("ownerId" in schema!.shape!).toBe(false);

    // Defense-in-depth: description strings are not the trust boundary;
    // schema keys are. Walk every key at every nesting depth.
    const allKeys = collectAllKeys(schema!.shape!);
    expect(allKeys.every((k) => !/^(userId|user_id|ownerId)$/i.test(k))).toBe(
      true,
    );
  });

  it("findRelevantPublishedContent.inputSchema does not expose any user identifier", () => {
    const tools = buildCloneTools(fakeOwner);
    const schema = tools.findRelevantPublishedContent.inputSchema as
      | { shape?: Record<string, unknown> }
      | undefined;

    expect(schema).toBeDefined();
    expect(schema!.shape).toBeDefined();
    expect("userId" in schema!.shape!).toBe(false);
    expect("user_id" in schema!.shape!).toBe(false);
    expect("ownerId" in schema!.shape!).toBe(false);
    expect("username" in schema!.shape!).toBe(false);

    const allKeys = collectAllKeys(schema!.shape!);
    expect(
      allKeys.every(
        (k) => !/^(userId|user_id|ownerId|username)$/i.test(k),
      ),
    ).toBe(true);
  });

  it("getLatestPublished.inputSchema exposes only `kind` (the LLM-visible surface)", () => {
    const tools = buildCloneTools(fakeOwner);
    const schema = tools.getLatestPublished.inputSchema as {
      shape: Record<string, unknown>;
    };
    expect(Object.keys(schema.shape).sort()).toEqual(["kind"]);
  });

  it("navigateToContent.inputSchema exposes only `kind` and `slug` (no user identifier)", () => {
    const tools = buildCloneTools(fakeOwner);
    const schema = tools.navigateToContent.inputSchema as {
      shape: Record<string, unknown>;
    };
    expect(Object.keys(schema.shape).sort()).toEqual(["kind", "slug"]);
  });

  it("findRelevantPublishedContent.inputSchema exposes only query, kind, and limit", () => {
    const tools = buildCloneTools(fakeOwner);
    const schema = tools.findRelevantPublishedContent.inputSchema as {
      shape: Record<string, unknown>;
      safeParse: (value: unknown) => { success: boolean };
    };

    expect(Object.keys(schema.shape).sort()).toEqual([
      "kind",
      "limit",
      "query",
    ]);
    expect(
      schema.safeParse({
        query: "greyboard ai",
        kind: "articles",
        limit: 2,
      }).success,
    ).toBe(true);
    expect(
      schema.safeParse({
        query: "greyboard ai",
        kind: "bio",
      }).success,
    ).toBe(false);
  });

  it("navigateToContent registry drift: accepts navigable kinds and rejects non-navigable source tables", () => {
    const tools = buildCloneTools(fakeOwner);
    const schema = tools.navigateToContent.inputSchema as {
      safeParse: (value: unknown) => { success: boolean };
    };

    for (const source of NAVIGABLE_CONTENT_SOURCES) {
      expect(
        schema.safeParse({
          kind: source.navigation.kind,
          slug: "example-slug",
        }).success,
      ).toBe(true);
    }

    for (const source of CONTENT_SOURCES) {
      if (source.navigation.navigable) continue;
      expect(
        schema.safeParse({
          kind: source.sourceTable,
          slug: "example-slug",
        }).success,
      ).toBe(false);
    }
  });

  it("openProfileSection.inputSchema does not expose userId (or any user identifier)", () => {
    // Cross-user isolation invariant — the closure binds `profileOwnerId`
    // server-side; the LLM-visible surface must never accept a user id.
    // Mirrors the `navigateToContent.inputSchema` assertion above.
    const tools = buildCloneTools(fakeOwner);
    const schema = tools.openProfileSection.inputSchema as
      | { shape?: Record<string, unknown> }
      | undefined;

    expect(schema).toBeDefined();
    expect(schema!.shape).toBeDefined();
    expect("userId" in schema!.shape!).toBe(false);
    expect("user_id" in schema!.shape!).toBe(false);
    expect("ownerId" in schema!.shape!).toBe(false);

    const allKeys = collectAllKeys(schema!.shape!);
    expect(allKeys.every((k) => !/^(userId|user_id|ownerId)$/i.test(k))).toBe(
      true,
    );
  });

  it("deletePost.inputSchema does not expose userId (or any user identifier)", () => {
    // Cross-user isolation invariant — `deletePost` mutates state, so a
    // userId leak in `inputSchema` would let the LLM target another user's
    // post. The closure binds `profileOwnerId` server-side; the LLM-visible
    // surface is `slug` only, and the internal mutation re-checks ownership
    // against the closure-bound id (`isOwnedByUser`) before deleting.
    const tools = buildCloneTools(fakeOwner);
    const schema = tools.deletePost.inputSchema as
      | { shape?: Record<string, unknown> }
      | undefined;

    expect(schema).toBeDefined();
    expect(schema!.shape).toBeDefined();
    expect("userId" in schema!.shape!).toBe(false);
    expect("user_id" in schema!.shape!).toBe(false);
    expect("ownerId" in schema!.shape!).toBe(false);

    const allKeys = collectAllKeys(schema!.shape!);
    expect(allKeys.every((k) => !/^(userId|user_id|ownerId)$/i.test(k))).toBe(
      true,
    );
  });

  it("deletePost.inputSchema exposes only `slug` (no user identifier, no kind)", () => {
    // `deletePost` is post-only by design — there's no `kind` slot, so the
    // LLM cannot ask the tool to delete an article by reusing the same verb.
    // (The agent does not have an article-delete verb today; if one is added,
    // it should be a separate tool with its own `inputSchema invariants`
    // test, not a `kind` enum widening on this one.)
    const tools = buildCloneTools(fakeOwner);
    const schema = tools.deletePost.inputSchema as {
      shape: Record<string, unknown>;
    };
    expect(Object.keys(schema.shape).sort()).toEqual(["slug"]);
  });

  for (const toolName of [
    "publishPost",
    "unpublishPost",
    "deleteArticle",
    "publishArticle",
    "unpublishArticle",
  ] as const) {
    it(`${toolName}.inputSchema does not expose userId (or any user identifier)`, () => {
      const tools = buildCloneTools(fakeOwner);
      const schema = tools[toolName].inputSchema as
        | { shape?: Record<string, unknown> }
        | undefined;

      expect(schema).toBeDefined();
      expect(schema!.shape).toBeDefined();
      expect("userId" in schema!.shape!).toBe(false);
      expect("user_id" in schema!.shape!).toBe(false);
      expect("ownerId" in schema!.shape!).toBe(false);

      const allKeys = collectAllKeys(schema!.shape!);
      expect(allKeys.every((k) => !/^(userId|user_id|ownerId)$/i.test(k))).toBe(
        true,
      );
    });

    it(`${toolName}.inputSchema exposes only slug`, () => {
      const tools = buildCloneTools(fakeOwner);
      const schema = tools[toolName].inputSchema as {
        shape: Record<string, unknown>;
      };
      expect(Object.keys(schema.shape).sort()).toEqual(["slug"]);
    });
  }

  it("openProfileSection.inputSchema exposes only `section`, bounded to the visitor-visible subset", () => {
    // Pins both the shape (one key, `section`) and the enum range
    // (`bio | contact | articles | posts` only — `clone-settings` is
    // owner-only and not in the agent's verb space). A future edit that
    // widens the enum to `clone-settings` would let the agent navigate
    // visitors into a page they cannot render; this test catches that
    // drift.
    const tools = buildCloneTools(fakeOwner);
    const schema = tools.openProfileSection.inputSchema as {
      shape: Record<string, unknown>;
    };
    expect(Object.keys(schema.shape).sort()).toEqual(["section"]);

    const sectionField = schema.shape.section as
      | { _def?: { values?: unknown }; options?: unknown }
      | undefined;
    // Zod v4 stores enum values on `_def.entries` (object form) or on
    // `options` (array form depending on version). Try both paths and
    // normalize to a sorted string array.
    const rawEntries =
      (sectionField?._def as { entries?: Record<string, string> } | undefined)
        ?.entries ??
      (sectionField?._def as { values?: string[] } | undefined)?.values ??
      sectionField?.options;
    const values = Array.isArray(rawEntries)
      ? (rawEntries as string[])
      : rawEntries
        ? Object.values(rawEntries as Record<string, string>)
        : [];
    expect([...values].sort()).toEqual([
      "articles",
      "bio",
      "contact",
      "posts",
    ]);
  });

  it("owner-write tools reject anonymous and non-owner viewers before reads or writes", async () => {
    const owner = "users_owner" as unknown as Id<"users">;
    const visitor = "users_visitor" as unknown as Id<"users">;
    const runMutation = vi.fn();
    const runQuery = vi.fn();
    const blockedCtx = {
      runMutation,
      runQuery,
    } as unknown as Parameters<
      ReturnType<typeof buildCloneTools>["publishPost"]["execute"]
    >[0];

    const nonOwnerTools = buildCloneTools(owner, { viewerId: visitor });
    await expect(
      nonOwnerTools.deletePost.execute(blockedCtx, { slug: "draft" }),
    ).rejects.toThrow("Only the profile owner");
    await expect(
      nonOwnerTools.publishPost.execute(blockedCtx, { slug: "draft" }),
    ).rejects.toThrow("Only the profile owner");
    await expect(
      nonOwnerTools.unpublishPost.execute(blockedCtx, { slug: "draft" }),
    ).rejects.toThrow("Only the profile owner");
    await expect(
      nonOwnerTools.deleteArticle.execute(blockedCtx, { slug: "draft" }),
    ).rejects.toThrow("Only the profile owner");
    await expect(
      nonOwnerTools.publishArticle.execute(blockedCtx, { slug: "draft" }),
    ).rejects.toThrow("Only the profile owner");
    await expect(
      nonOwnerTools.unpublishArticle.execute(blockedCtx, { slug: "draft" }),
    ).rejects.toThrow("Only the profile owner");

    const anonymousTools = buildCloneTools(owner);
    await expect(
      anonymousTools.publishPost.execute(blockedCtx, { slug: "draft" }),
    ).rejects.toThrow("Only the profile owner");

    expect(runQuery).not.toHaveBeenCalled();
    expect(runMutation).not.toHaveBeenCalled();
  });
});

describe("chat/tools write parity — execute", () => {
  function buildCtx(t: ReturnType<typeof makeT>) {
    return {
      runMutation: (ref: unknown, args: Record<string, unknown>) =>
        t.mutation(ref as never, args as never),
      runQuery: (ref: unknown, args: Record<string, unknown>) =>
        t.query(ref as never, args as never),
    } as unknown as Parameters<
      ReturnType<typeof buildCloneTools>["publishPost"]["execute"]
    >[0];
  }

  async function insertPost(
    t: ReturnType<typeof makeT>,
    owner: Id<"users">,
    fields: {
      slug: string;
      title: string;
      status: "draft" | "published";
    },
  ) {
    return t.run(async (ctx) =>
      ctx.db.insert("posts", {
        userId: owner,
        slug: fields.slug,
        title: fields.title,
        category: "general",
        body: { type: "doc", content: [] },
        status: fields.status,
        publishedAt: fields.status === "published" ? 1000 : undefined,
        createdAt: 1000,
      }),
    );
  }

  async function insertArticle(
    t: ReturnType<typeof makeT>,
    owner: Id<"users">,
    fields: {
      slug: string;
      title: string;
      status: "draft" | "published";
      coverImageStorageId?: Id<"_storage">;
    },
  ) {
    return t.run(async (ctx) =>
      ctx.db.insert("articles", {
        userId: owner,
        slug: fields.slug,
        title: fields.title,
        category: "blog",
        body: { type: "doc", content: [] },
        status: fields.status,
        publishedAt: fields.status === "published" ? 1000 : undefined,
        createdAt: 1000,
        coverImageStorageId: fields.coverImageStorageId,
      }),
    );
  }

  it("publishPost publishes a draft post and returns its canonical detail href", async () => {
    const t = makeT();
    const owner = await insertOwner(t, "owner_publish_post");
    const postId = await insertPost(t, owner, {
      slug: "draft-post",
      title: "Draft Post",
      status: "draft",
    });

    const tools = buildCloneTools(owner, { viewerId: owner });
    const result = await tools.publishPost.execute(buildCtx(t), {
      slug: "draft-post",
    });

    expect(result).toMatchObject({
      kind: "posts",
      status: "published",
      updated: true,
      changed: true,
      slug: "draft-post",
      title: "Draft Post",
      href: buildContentHref("owner_publish_post", "posts", "draft-post"),
    });

    const row = await t.run(async (ctx) => ctx.db.get(postId));
    expect(row!.status).toBe("published");
    expect(row!.publishedAt).toBeTypeOf("number");
  });

  it("unpublishArticle moves a published article to draft and returns the articles-list href", async () => {
    const t = makeT();
    const owner = await insertOwner(t, "owner_unpublish_article");
    const articleId = await insertArticle(t, owner, {
      slug: "published-article",
      title: "Published Article",
      status: "published",
    });

    const tools = buildCloneTools(owner, { viewerId: owner });
    const result = await tools.unpublishArticle.execute(buildCtx(t), {
      slug: "published-article",
    });

    expect(result).toMatchObject({
      kind: "articles",
      status: "draft",
      updated: true,
      changed: true,
      slug: "published-article",
      title: "Published Article",
      href: buildContentHref("owner_unpublish_article", "articles"),
    });

    const row = await t.run(async (ctx) => ctx.db.get(articleId));
    expect(row!.status).toBe("draft");
  });

  it("deleteArticle deletes the article and returns the articles-list href", async () => {
    const t = makeT();
    const owner = await insertOwner(t, "owner_delete_article");
    const coverImageStorageId = await t.run(async (ctx) =>
      ctx.storage.store(new Blob(["cover"])),
    );
    await t.run(async (ctx) =>
      ctx.db.insert("coverImageOwnership", {
        storageId: coverImageStorageId,
        userId: owner,
        createdAt: 1000,
        kind: "image",
      }),
    );
    const articleId = await insertArticle(t, owner, {
      slug: "remove-me",
      title: "Remove Me",
      status: "published",
      coverImageStorageId,
    });

    const tools = buildCloneTools(owner, { viewerId: owner });
    const result = await tools.deleteArticle.execute(buildCtx(t), {
      slug: "remove-me",
    });

    expect(result).toMatchObject({
      kind: "articles",
      deleted: true,
      slug: "remove-me",
      title: "Remove Me",
      href: buildContentHref("owner_delete_article", "articles"),
    });
    expect(await t.run(async (ctx) => ctx.db.get(articleId))).toBeNull();
    expect(
      await t.run(async (ctx) => ctx.db.system.get(coverImageStorageId)),
    ).toBeNull();
    expect(
      await t.run(async (ctx) =>
        ctx.db
          .query("coverImageOwnership")
          .withIndex("by_storageId", (q) =>
            q.eq("storageId", coverImageStorageId),
          )
          .unique(),
      ),
    ).toBeNull();
  });

  it("SECURITY: publishPost does not update a post owned by a different user", async () => {
    const t = makeT();
    const userA = await insertOwner(t, "user_a_publish_iso");
    const userB = await insertOwner(t, "user_b_publish_iso");
    const bPostId = await insertPost(t, userB, {
      slug: "shared-slug",
      title: "B Draft",
      status: "draft",
    });

    const toolsForA = buildCloneTools(userA, { viewerId: userA });
    const result = await toolsForA.publishPost.execute(buildCtx(t), {
      slug: "shared-slug",
    });

    expect(result).toMatchObject({
      kind: "posts",
      status: "published",
      updated: false,
      changed: false,
      slug: "shared-slug",
      href: buildContentHref("user_a_publish_iso", "posts"),
    });

    const bPost = await t.run(async (ctx) => ctx.db.get(bPostId));
    expect(bPost!.status).toBe("draft");
  });
});

describe("chat/tools.openProfileSection — execute", () => {
  // Behavioural coverage for the agent verb that powers tab-level
  // navigation. Each `section` branch must:
  //   - resolve the canonical href via the server-side helper,
  //   - report `hasEntries` truthfully against published rows,
  //   - never leak across users.
  // The `clone-settings` enum value is intentionally absent from the
  // agent's surface — it's a separate test (`inputSchema invariants`
  // above) that pins it.

  // Reach into the AI-SDK Tool wrapper. `createTool` is mocked at the top
  // of this file to be the identity (returns its def), so `execute` is
  // directly callable with a synthetic ctx.
  type ProfileSection = "bio" | "articles" | "posts";
  function buildCtx(t: ReturnType<typeof makeT>) {
    return {
      runQuery: (
        ref: unknown,
        args: { userId: Id<"users">; section?: ProfileSection },
      ) => t.query(ref as never, args as never),
    } as unknown as Parameters<
      ReturnType<typeof buildCloneTools>["openProfileSection"]["execute"]
    >[0];
  }

  it("section=bio with bio entries → hasEntries true and canonical href", async () => {
    const t = makeT();
    const owner = await insertOwner(t, "owner_section_bio");
    await t.run(async (ctx) =>
      ctx.db.insert("bioEntries", {
        userId: owner,
        kind: "work",
        title: "Built X",
        startDate: 1577836800000,
        endDate: null,
      }),
    );

    const tools = buildCloneTools(owner, { viewerId: owner });
    const result = await tools.openProfileSection.execute(buildCtx(t), {
      section: "bio",
    });

    expect(result.kind).toBe("bio");
    expect(result.hasEntries).toBe(true);
    expect(result.href).toBe(buildBioHref("owner_section_bio"));
  });

  it("section=bio with no entries → hasEntries false but href still resolves", async () => {
    const t = makeT();
    const owner = await insertOwner(t, "owner_section_bio_empty");

    const tools = buildCloneTools(owner, { viewerId: owner });
    const result = await tools.openProfileSection.execute(buildCtx(t), {
      section: "bio",
    });

    expect(result.kind).toBe("bio");
    expect(result.hasEntries).toBe(false);
    expect(result.href).toBe(buildBioHref("owner_section_bio_empty"));
  });

  it("section=articles with a published article → hasEntries true and canonical href", async () => {
    const t = makeT();
    const owner = await insertOwner(t, "owner_section_articles");
    await t.run(async (ctx) =>
      ctx.db.insert("articles", {
        userId: owner,
        slug: "first",
        title: "First",
        category: "blog",
        body: { type: "doc", content: [] },
        status: "published",
        publishedAt: 1000,
        createdAt: 1000,
      }),
    );

    const tools = buildCloneTools(owner, { viewerId: owner });
    const result = await tools.openProfileSection.execute(buildCtx(t), {
      section: "articles",
    });

    expect(result.kind).toBe("articles");
    expect(result.hasEntries).toBe(true);
    expect(result.href).toBe(
      buildContentHref("owner_section_articles", "articles"),
    );
  });

  it("section=articles with only drafts → hasEntries false (drafts are not retrieval-eligible)", async () => {
    const t = makeT();
    const owner = await insertOwner(t, "owner_section_articles_drafts");
    await t.run(async (ctx) =>
      ctx.db.insert("articles", {
        userId: owner,
        slug: "draft-only",
        title: "Draft only",
        category: "blog",
        body: { type: "doc", content: [] },
        status: "draft",
        createdAt: 1000,
      }),
    );

    const tools = buildCloneTools(owner, { viewerId: owner });
    const result = await tools.openProfileSection.execute(buildCtx(t), {
      section: "articles",
    });

    expect(result.kind).toBe("articles");
    expect(result.hasEntries).toBe(false);
    expect(result.href).toBe(
      buildContentHref("owner_section_articles_drafts", "articles"),
    );
  });

  it("section=posts with a published post → hasEntries true and canonical href", async () => {
    const t = makeT();
    const owner = await insertOwner(t, "owner_section_posts");
    await t.run(async (ctx) =>
      ctx.db.insert("posts", {
        userId: owner,
        slug: "hello",
        title: "Hello",
        category: "general",
        body: { type: "doc", content: [] },
        status: "published",
        publishedAt: 1000,
        createdAt: 1000,
      }),
    );

    const tools = buildCloneTools(owner, { viewerId: owner });
    const result = await tools.openProfileSection.execute(buildCtx(t), {
      section: "posts",
    });

    expect(result.kind).toBe("posts");
    expect(result.hasEntries).toBe(true);
    expect(result.href).toBe(buildContentHref("owner_section_posts", "posts"));
  });

  it("SECURITY: a posts row owned by a different user does NOT make hasEntries true for the queried owner", async () => {
    // Cross-user isolation regression — the closure-bound `profileOwnerId`
    // is the only userId reachable by the tool. A row published by user B
    // must not show up in user A's openProfileSection result.
    const t = makeT();
    const userA = await insertOwner(t, "section_user_a");
    const userB = await insertOwner(t, "section_user_b");

    await t.run(async (ctx) =>
      ctx.db.insert("posts", {
        userId: userB,
        slug: "b-only",
        title: "B's post",
        category: "general",
        body: { type: "doc", content: [] },
        status: "published",
        publishedAt: 1000,
        createdAt: 1000,
      }),
    );

    const toolsForA = buildCloneTools(userA, { viewerId: userA });
    const aResult = await toolsForA.openProfileSection.execute(buildCtx(t), {
      section: "posts",
    });
    expect(aResult.kind).toBe("posts");
    expect(aResult.hasEntries).toBe(false);
    expect(aResult.href).toBe(buildContentHref("section_user_a", "posts"));

    // Positive control — user B's own tools should see the published row.
    const toolsForB = buildCloneTools(userB);
    const bResult = await toolsForB.openProfileSection.execute(buildCtx(t), {
      section: "posts",
    });
    expect(bResult.hasEntries).toBe(true);
  });
});

describe("chat/tools.deletePost — execute", () => {
  // Behavioural coverage for the agent verb that mirrors the post-detail
  // toolbar's Delete button. The execute path must:
  //   - resolve the post by `(profileOwnerId, slug)` via the cross-user-safe
  //     compound index in `internal.posts.mutations.deleteByUserAndSlug`,
  //   - delete only when the post is owned by the closure-bound owner,
  //   - return a structured result with `deleted`, `slug`, `title?`, and a
  //     server-built posts-list `href` so the client-side intent watcher can
  //     navigate the visitor away from the now-deleted detail page.
  // The `inputSchema invariants` block above pins that no userId reaches
  // the LLM-visible surface.
  type DeletePostArgs = { slug: string };
  function buildCtx(t: ReturnType<typeof makeT>) {
    return {
      runMutation: (
        ref: unknown,
        args: { userId: Id<"users">; slug: string },
      ) => t.mutation(ref as never, args as never),
      runQuery: (
        ref: unknown,
        args: { userId: Id<"users">; section?: "articles" | "posts" },
      ) => t.query(ref as never, args as never),
    } as unknown as Parameters<
      ReturnType<typeof buildCloneTools>["deletePost"]["execute"]
    >[0];
  }

  async function insertPublishedPost(
    t: ReturnType<typeof makeT>,
    owner: Id<"users">,
    slug: string,
    title: string,
  ) {
    return t.run(async (ctx) =>
      ctx.db.insert("posts", {
        userId: owner,
        slug,
        title,
        category: "general",
        body: { type: "doc", content: [] },
        status: "published",
        publishedAt: 1000,
        createdAt: 1000,
      }),
    );
  }

  it("deletes the post and returns the canonical posts-list href", async () => {
    const t = makeT();
    const owner = await insertOwner(t, "owner_delete_post");
    const postId = await insertPublishedPost(
      t,
      owner,
      "to-delete",
      "Going Away",
    );

    const tools = buildCloneTools(owner, { viewerId: owner });
    const result = await tools.deletePost.execute(buildCtx(t), {
      slug: "to-delete",
    } satisfies DeletePostArgs);

    expect(result.kind).toBe("posts");
    expect(result.deleted).toBe(true);
    expect(result.slug).toBe("to-delete");
    expect(result.title).toBe("Going Away");
    expect(result.href).toBe(buildContentHref("owner_delete_post", "posts"));

    // The row is actually gone — not a soft delete or status flip.
    const remaining = await t.run(async (ctx) => ctx.db.get(postId));
    expect(remaining).toBeNull();
  });

  it("returns deleted=false (not throw) when the slug does not match a post for this owner", async () => {
    // Stale slug from the LLM (typo, hallucination, already-deleted) must
    // surface as a normal tool result the agent can recover from in text,
    // not as an error that breaks the stream. The href is still resolved so
    // the watcher can move the visitor off any stale detail page.
    const t = makeT();
    const owner = await insertOwner(t, "owner_missing_slug");

    const tools = buildCloneTools(owner, { viewerId: owner });
    const result = await tools.deletePost.execute(buildCtx(t), {
      slug: "never-existed",
    });

    expect(result.kind).toBe("posts");
    expect(result.deleted).toBe(false);
    expect(result.slug).toBe("never-existed");
    expect(result.title).toBeUndefined();
    expect(result.href).toBe(buildContentHref("owner_missing_slug", "posts"));
  });

  it("SECURITY: a slug owned by a DIFFERENT user is NOT deleted (cross-user isolation)", async () => {
    // The most important regression guard for this verb. User A's clone
    // agent must not be able to delete a post owned by user B by passing
    // B's slug. The internal mutation keys on `(profileOwnerId, slug)` via
    // the compound index AND re-asserts `isOwnedByUser` — both must hold
    // for the row to be reachable.
    const t = makeT();
    const userA = await insertOwner(t, "user_a_delete_iso");
    const userB = await insertOwner(t, "user_b_delete_iso");

    const bPostId = await insertPublishedPost(
      t,
      userB,
      "shared-slug",
      "B's post",
    );

    const toolsForA = buildCloneTools(userA, { viewerId: userA });
    const result = await toolsForA.deletePost.execute(buildCtx(t), {
      slug: "shared-slug",
    });

    expect(result.deleted).toBe(false);
    // B's post is still alive — same-row read confirms the delete did NOT
    // cross the user boundary.
    const stillThere = await t.run(async (ctx) => ctx.db.get(bPostId));
    expect(stillThere).not.toBeNull();
    expect(stillThere!.title).toBe("B's post");
  });

  it("scopes posts-only — does NOT delete an article that happens to share a slug", async () => {
    // Defensive parity with `resolveBySlug`'s "scopes posts independently
    // from articles" test. The verb is post-only by `inputSchema` (no `kind`
    // slot), and the internal mutation only queries the `posts` table, so
    // an article with the same slug must be untouched.
    const t = makeT();
    const owner = await insertOwner(t, "owner_post_only");

    const articleId = await t.run(async (ctx) =>
      ctx.db.insert("articles", {
        userId: owner,
        slug: "shared-slug",
        title: "An Article",
        category: "blog",
        body: { type: "doc", content: [] },
        status: "published",
        publishedAt: 1000,
        createdAt: 1000,
      }),
    );
    const postId = await insertPublishedPost(t, owner, "shared-slug", "A Post");

    const tools = buildCloneTools(owner, { viewerId: owner });
    const result = await tools.deletePost.execute(buildCtx(t), {
      slug: "shared-slug",
    });

    expect(result.deleted).toBe(true);
    expect(result.title).toBe("A Post");
    // The post is gone, but the article (different table, different verb)
    // is still alive.
    expect(await t.run(async (ctx) => ctx.db.get(postId))).toBeNull();
    expect(await t.run(async (ctx) => ctx.db.get(articleId))).not.toBeNull();
  });
});

describe("chat/toolQueries.queryBioPanel", () => {
  it("returns href + hasEntries=true when the owner has bio entries", async () => {
    const t = makeT();
    const owner = await insertOwner(t, "owner_bio_with_entries");

    await t.run(async (ctx) =>
      ctx.db.insert("bioEntries", {
        userId: owner,
        kind: "work",
        title: "Built Disquiet",
        startDate: 1577836800000,
        endDate: null,
      }),
    );

    const result = await t.query(internal.chat.toolQueries.queryBioPanel, {
      userId: owner,
    });

    expect(result).not.toBeNull();
    expect(result!.username).toBe("owner_bio_with_entries");
    // Asserts via `buildBioHref` (not a string literal) so a future template
    // change to the helper without a corresponding query update — or vice
    // versa — fails this test loudly. Mirrors the `resolveBySlug` parity
    // pattern below (`buildContentHref` assertion).
    expect(result!.href).toBe(buildBioHref(result!.username));
    expect(result!.hasEntries).toBe(true);
  });

  it("returns href + hasEntries=false when the owner has NO bio entries (panel still navigable)", async () => {
    // Empty bio panel is still a real user-reachable view — the agent must
    // be allowed to navigate there. Refusing to resolve when `hasEntries`
    // is false would re-introduce the "I don't have a full bio page to
    // pull up" parity bug this verb exists to fix.
    const t = makeT();
    const owner = await insertOwner(t, "owner_bio_empty");

    const result = await t.query(internal.chat.toolQueries.queryBioPanel, {
      userId: owner,
    });

    expect(result).not.toBeNull();
    expect(result!.username).toBe("owner_bio_empty");
    expect(result!.href).toBe(buildBioHref(result!.username));
    expect(result!.hasEntries).toBe(false);
  });

  it("returns null when the owner row was deleted (orphaned userId)", async () => {
    // The openProfileSection tool's bio branch throws on null → LLM falls
    // back to text. The most
    // realistic real-world trigger of that path is an account deleted
    // between the chat session opening and the tool firing — the
    // schema-typed `Id<"users">` is still well-formed, but `ctx.db.get`
    // returns null. Pins the first of the two null-guards in
    // `queryBioPanel`'s handler.
    const t = makeT();
    const owner = await insertOwner(t, "owner_to_delete");
    await t.run(async (ctx) => ctx.db.delete(owner));

    const result = await t.query(internal.chat.toolQueries.queryBioPanel, {
      userId: owner,
    });

    expect(result).toBeNull();
  });

  it("returns null when the owner has no username (cannot build profile href)", async () => {
    const t = makeT();
    const ownerWithoutUsername = await t.run(async (ctx) =>
      ctx.db.insert("users", {
        authId: "auth_no_username",
        email: "no-username@example.com",
        // username intentionally omitted — `users.username` is optional.
        onboardingComplete: false,
      }),
    );

    const result = await t.query(internal.chat.toolQueries.queryBioPanel, {
      userId: ownerWithoutUsername,
    });

    expect(result).toBeNull();
  });

  it("SECURITY: scopes hasEntries to the queried userId — does not count entries owned by a different user", async () => {
    // Cross-user isolation: user A's `queryBioPanel` must not report
    // `hasEntries: true` because user B has populated their bio. Mirrors
    // the same-shape invariant `resolveBySlug` enforces with
    // `by_userId_and_slug`.
    const t = makeT();
    const userA = await insertOwner(t, "user_a_bio_iso");
    const userB = await insertOwner(t, "user_b_bio_iso");

    await t.run(async (ctx) =>
      ctx.db.insert("bioEntries", {
        userId: userB,
        kind: "education",
        title: "B.S. in Industrial Design",
        startDate: 1262304000000,
        endDate: 1388534400000,
      }),
    );

    const aResult = await t.query(internal.chat.toolQueries.queryBioPanel, {
      userId: userA,
    });
    const bResult = await t.query(internal.chat.toolQueries.queryBioPanel, {
      userId: userB,
    });

    expect(aResult).not.toBeNull();
    expect(aResult!.hasEntries).toBe(false);
    expect(bResult).not.toBeNull();
    expect(bResult!.hasEntries).toBe(true);
  });
});

describe("chat/toolQueries.buildContentHref", () => {
  // The href template `/@<username>/<kind>/<slug>` is the contract between
  // the agent's tool result and the Next.js route at
  // `apps/mirror/app/[username]/<kind>/[slug]/page.tsx`. A typo in the
  // template silently 404s the visitor — the unit test on the helper
  // catches that without needing to invoke the AI-SDK Tool wrapper (which
  // expects a ctx injected by the agent runtime via a `__acceptsCtx`
  // symbol; convex-test has no first-class way to construct one).
  it("builds the canonical /@<username>/articles/<slug> href", () => {
    expect(buildContentHref("alice", "articles", "hello-world")).toBe(
      "/@alice/articles/hello-world",
    );
  });

  it("builds the canonical /@<username>/posts/<slug> href", () => {
    expect(buildContentHref("bob", "posts", "first-post")).toBe(
      "/@bob/posts/first-post",
    );
  });

  // The shared helper (`packages/convex/convex/content/href.ts`) accepts an
  // optional slug — both consumers (this Convex side and the Next.js client
  // re-export at `apps/mirror/features/content/types.ts`) MUST cover the
  // slug-omitted path so a future template change can't silently regress
  // one consumer while the other passes. Mirror of the equivalent test in
  // `apps/mirror/features/content/__tests__/types.test.ts`.
  it("omits slug when not provided (list-route shape)", () => {
    expect(buildContentHref("alice", "articles")).toBe("/@alice/articles");
    expect(buildContentHref("bob", "posts")).toBe("/@bob/posts");
  });

  it("registry drift: every navigable source builds its canonical route segment", () => {
    for (const source of NAVIGABLE_CONTENT_SOURCES) {
      expect(
        buildContentHref("owner", source.navigation.kind, "example-slug"),
      ).toBe(`/@owner/${source.navigation.routeSegment}/example-slug`);
      expect(buildContentHref("owner", source.navigation.kind)).toBe(
        `/@owner/${source.navigation.routeSegment}`,
      );
    }
  });

  it("resolveBySlug returns the same href the helper builds (single source of truth)", async () => {
    // Confirms the tool path and the helper agree byte-for-byte on the URL
    // shape — if `resolveBySlug` ever forgets to call `buildContentHref`
    // and inlines its own template, this test catches the divergence.
    const t = makeT();
    const owner = await insertOwner(t, "owner_href");

    await t.run(async (ctx) =>
      ctx.db.insert("articles", {
        userId: owner,
        slug: "the-article",
        title: "The Article",
        category: "blog",
        body: { type: "doc", content: [] },
        status: "published",
        publishedAt: 1000,
        createdAt: 1000,
      }),
    );

    const result = await t.query(internal.chat.toolQueries.resolveBySlug, {
      userId: owner,
      kind: "articles",
      slug: "the-article",
    });

    expect(result).not.toBeNull();
    expect(result!.href).toBe(
      buildContentHref("owner_href", "articles", "the-article"),
    );
  });
});
