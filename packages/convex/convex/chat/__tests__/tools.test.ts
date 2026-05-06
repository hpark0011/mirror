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
import { normalizeConvexGlob } from "./testUtils";
import type { Id } from "../../_generated/dataModel";

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
    const postResult = await t.query(
      internal.chat.toolQueries.resolveBySlug,
      { userId: owner, kind: "posts", slug: "shared-slug" },
    );

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

  it("openBio.inputSchema is empty — owner is closure-bound, never a tool arg", () => {
    // The `openBio` verb takes no args. The closure binds `profileOwnerId`
    // server-side; the LLM-visible surface must be `{}` so the model can
    // never pass a foreign user identifier through tool arguments. Mirrors
    // the cross-user isolation contract in `.claude/rules/agent-parity.md`.
    const tools = buildCloneTools(fakeOwner);
    const schema = tools.openBio.inputSchema as {
      shape?: Record<string, unknown>;
    };

    expect(schema).toBeDefined();
    expect(schema.shape).toBeDefined();
    expect(Object.keys(schema.shape!)).toEqual([]);

    // Defense-in-depth: walk every nested shape — even an empty top-level
    // shape should never contain a user identifier at any depth (this
    // catches a future edit that adds `z.object({ ctx: z.object({ userId: ... }) })`).
    const allKeys = collectAllKeys(schema.shape!);
    expect(allKeys.every((k) => !/^(userId|user_id|ownerId)$/i.test(k))).toBe(
      true,
    );
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
    expect(result!.href).toBe("/@owner_bio_with_entries/bio");
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
    expect(result!.href).toBe("/@owner_bio_empty/bio");
    expect(result!.hasEntries).toBe(false);
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
