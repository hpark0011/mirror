/// <reference types="vite/client" />

process.env.SITE_URL = process.env.SITE_URL ?? "https://test.local";
process.env.GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ?? "test-google-client-id";
process.env.GOOGLE_CLIENT_SECRET =
  process.env.GOOGLE_CLIENT_SECRET ?? "test-google-client-secret";

import { beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../schema";

// `embedMany` is the only outbound network call. Stub it to return one
// fake vector per input chunk so the action's downstream `insertChunks`
// path is exercised end-to-end without real API calls.
const embeddingsState = {
  embedManyCalls: 0,
  lastValues: [] as string[],
};

vi.mock("ai", () => {
  return {
    embed: vi.fn(async () => ({
      embedding: new Array(768).fill(0.01),
    })),
    embedMany: vi.fn(async ({ values }: { values: string[] }) => {
      embeddingsState.embedManyCalls += 1;
      embeddingsState.lastValues = values;
      return {
        embeddings: values.map(() => new Array(768).fill(0.01)),
      };
    }),
  };
});

vi.mock("@ai-sdk/google", () => {
  return {
    google: {
      textEmbeddingModel: vi.fn(() => ({})),
    },
  };
});

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
import { buildEmbeddingUserSourceKey } from "../schema";
import {
  contentSourceRegistry,
  INDEXABLE_CONTENT_SOURCE_TABLES,
  INDEXABLE_CONTENT_SOURCES,
} from "../../content/sourceRegistry";
import {
  EMBEDDING_CONTENT_READER_SOURCE_TABLES,
  EMBEDDING_SOURCE_ID_LISTER_SOURCE_TABLES,
} from "../queries";

function normalizeConvexGlob(
  raw: Record<string, () => Promise<unknown>>,
): Record<string, () => Promise<unknown>> {
  const out: Record<string, () => Promise<unknown>> = {};
  for (const [key, loader] of Object.entries(raw)) {
    let k = key;
    if (k.startsWith("./")) {
      k = "../../embeddings/__tests__/" + k.slice(2);
    } else if (k.startsWith("../") && !k.startsWith("../../")) {
      k = "../../embeddings/" + k.slice(3);
    }
    out[k] = loader;
  }
  return out;
}

const rawModules = import.meta.glob("../../**/*.{ts,js}");
const modules = normalizeConvexGlob(rawModules);

function makeT() {
  return convexTest(schema, modules);
}

function utcMonth(year: number, month: number): number {
  return Date.UTC(year, month - 1, 1);
}

function sorted(values: readonly string[]): string[] {
  return [...values].sort();
}

async function insertOwner(t: ReturnType<typeof makeT>, name = "owner") {
  return t.run(async (ctx) =>
    ctx.db.insert("users", {
      authId: `auth_${name}`,
      email: `${name}@example.com`,
      username: name,
      onboardingComplete: true,
    }),
  );
}

describe("embeddings: bio source — discriminated union & status gate (FR-12, NFR-03, Issues C1, I5)", () => {
  beforeEach(() => {
    embeddingsState.embedManyCalls = 0;
    embeddingsState.lastValues = [];
  });

  it("registry drift: every indexable source has embedding reader and lister coverage", () => {
    const registryTables = sorted(INDEXABLE_CONTENT_SOURCE_TABLES);

    expect(sorted(EMBEDDING_CONTENT_READER_SOURCE_TABLES)).toEqual(
      registryTables,
    );
    expect(sorted(EMBEDDING_SOURCE_ID_LISTER_SOURCE_TABLES)).toEqual(
      registryTables,
    );

    for (const [sourceTable, source] of Object.entries(contentSourceRegistry)) {
      expect(source.sourceTable).toBe(sourceTable);
    }

    for (const source of INDEXABLE_CONTENT_SOURCES) {
      expect(["document", "bio", "contact"]).toContain(
        source.embedding.serializer,
      );
      expect(["draft-published", "always-indexable"]).toContain(
        source.embedding.lifecycle,
      );
    }
  });

  it("getContentForEmbedding returns kind:'bio' for a bioEntries source", async () => {
    const t = makeT();
    const ownerId = await insertOwner(t, "bio_user");

    const entryId = await t.run(async (ctx) =>
      ctx.db.insert("bioEntries", {
        userId: ownerId,
        kind: "work",
        title: "Senior Engineer at Acme",
        startDate: utcMonth(2022, 1),
        endDate: utcMonth(2024, 3),
      }),
    );

    const content = await t.query(
      internal.embeddings.queries.getContentForEmbedding,
      { sourceTable: "bioEntries", sourceId: entryId },
    );
    expect(content).not.toBeNull();
    expect(content!.kind).toBe("bio");
    if (content!.kind !== "bio") throw new Error("type-narrow");
    expect(content.title).toBe("Senior Engineer at Acme");
    // Body is the prose-serialized form.
    expect(content.body).toMatch(/^Worked as Senior Engineer at Acme from January 2022 to March 2024\./);
    expect(content.userId).toBe(ownerId);
  });

  it("getContentForEmbedding returns kind:'doc' for an articles source (snapshot the existing shape)", async () => {
    const t = makeT();
    const ownerId = await insertOwner(t, "doc_user");

    const articleId = await t.run(async (ctx) =>
      ctx.db.insert("articles", {
        userId: ownerId,
        slug: "hello",
        title: "Hello World",
        category: "blog",
        body: { type: "doc", content: [] },
        status: "published",
        createdAt: Date.now(),
      }),
    );

    const content = await t.query(
      internal.embeddings.queries.getContentForEmbedding,
      { sourceTable: "articles", sourceId: articleId },
    );
    expect(content).not.toBeNull();
    expect(content!.kind).toBe("doc");
    if (content!.kind !== "doc") throw new Error("type-narrow");
    expect(content.slug).toBe("hello");
    expect(content.title).toBe("Hello World");
    expect(content.status).toBe("published");
    expect(content.userId).toBe(ownerId);
    // body round-trips as the TipTap JSON object the row stored.
    expect(content.body).toEqual({ type: "doc", content: [] });
  });

  // NFR-03 symmetric coverage — posts must round-trip the same discriminated
  // doc shape as articles. Without this, a divergence between the articles
  // and posts branches (e.g., a missed field on the posts side after the
  // validator extraction) would only surface in production.
  it("NFR-03: getContentForEmbedding returns kind:'doc' for a posts source with identical shape", async () => {
    const t = makeT();
    const ownerId = await insertOwner(t, "doc_user_post");

    const postId = await t.run(async (ctx) =>
      ctx.db.insert("posts", {
        userId: ownerId,
        slug: "post-slug",
        title: "Post Title",
        category: "general",
        body: { type: "doc", content: [] },
        status: "published",
        createdAt: Date.now(),
      }),
    );

    const content = await t.query(
      internal.embeddings.queries.getContentForEmbedding,
      { sourceTable: "posts", sourceId: postId },
    );
    expect(content).not.toBeNull();
    expect(content!.kind).toBe("doc");
    if (content!.kind !== "doc") throw new Error("type-narrow");
    expect(content.slug).toBe("post-slug");
    expect(content.title).toBe("Post Title");
    expect(content.status).toBe("published");
    expect(content.userId).toBe(ownerId);
    expect(content.body).toEqual({ type: "doc", content: [] });
  });

  it("getContentForEmbedding returns null for a missing source", async () => {
    const t = makeT();
    // Insert and delete a row to obtain a valid-shaped id that no longer
    // resolves. `ctx.db.delete` with the id pattern.
    const ownerId = await insertOwner(t, "missing_src");
    const entryId = await t.run(async (ctx) =>
      ctx.db.insert("bioEntries", {
        userId: ownerId,
        kind: "work",
        title: "tmp",
        startDate: utcMonth(2020, 1),
        endDate: null,
      }),
    );
    await t.run(async (ctx) => ctx.db.delete(entryId));

    const content = await t.query(
      internal.embeddings.queries.getContentForEmbedding,
      { sourceTable: "bioEntries", sourceId: entryId },
    );
    expect(content).toBeNull();
  });

  it("FR-12 + Issue C1: generateEmbedding does NOT trip the published-status gate for bio entries", async () => {
    const t = makeT();
    const ownerId = await insertOwner(t, "bio_unpublished");

    const entryId = await t.run(async (ctx) =>
      ctx.db.insert("bioEntries", {
        userId: ownerId,
        kind: "education",
        title: "Computer Science at MIT",
        startDate: utcMonth(2014, 9),
        endDate: utcMonth(2018, 5),
      }),
    );

    await t.action(internal.embeddings.actions.generateEmbedding, {
      sourceTable: "bioEntries",
      sourceId: entryId,
    });

    // Embedding row inserted (gate did not delete it).
    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("contentEmbeddings")
        .withIndex("by_sourceTable_and_sourceId", (q) =>
          q.eq("sourceTable", "bioEntries").eq("sourceId", entryId),
        )
        .collect(),
    );
    expect(rows.length).toBe(1);
    const row = rows[0]!;
    expect(row.userId).toBe(ownerId);
    expect(row.userSourceKey).toBe(
      buildEmbeddingUserSourceKey(ownerId, "bioEntries"),
    );
    expect(row.chunkIndex).toBe(0);
    // FR-12: chunkText matches the actual prose template for education.
    expect(row.chunkText).toMatch(/^Studied Computer Science at MIT from /);
    // FR-12: slug is undefined (not "" — that would pollute consumers).
    expect(row.slug).toBeUndefined();
    // FR-12: title displays the human-readable handle.
    expect(row.title).toBe("Computer Science at MIT");
  });

  it("fetchChunksByIds returns source metadata for article chunks", async () => {
    const t = makeT();
    const ownerId = await insertOwner(t, "fetch_article_meta");

    const articleId = await t.run(async (ctx) =>
      ctx.db.insert("articles", {
        userId: ownerId,
        slug: "software-less-input",
        title: "Software with Less Input",
        category: "blog",
        body: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Greyboard AI article body." }],
            },
          ],
        },
        status: "published",
        createdAt: Date.now(),
      }),
    );

    await t.action(internal.embeddings.actions.generateEmbedding, {
      sourceTable: "articles",
      sourceId: articleId,
    });

    const [row] = await t.run(async (ctx) =>
      ctx.db
        .query("contentEmbeddings")
        .withIndex("by_sourceTable_and_sourceId", (q) =>
          q.eq("sourceTable", "articles").eq("sourceId", articleId),
        )
        .take(1),
    );
    expect(row).toBeDefined();
    expect(row!.userSourceKey).toBe(
      buildEmbeddingUserSourceKey(ownerId, "articles"),
    );

    const chunks = await t.query(internal.embeddings.queries.fetchChunksByIds, {
      ids: [row!._id],
    });

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({
      id: row!._id,
      sourceTable: "articles",
      sourceId: articleId,
      title: "Software with Less Input",
      slug: "software-less-input",
    });
  });

  it("fetchChunksByIds returns source metadata for bio chunks without a slug", async () => {
    const t = makeT();
    const ownerId = await insertOwner(t, "fetch_bio_meta");

    const entryId = await t.run(async (ctx) =>
      ctx.db.insert("bioEntries", {
        userId: ownerId,
        kind: "work",
        title: "Design Engineer at Delphi",
        startDate: utcMonth(2023, 1),
        endDate: null,
      }),
    );

    await t.action(internal.embeddings.actions.generateEmbedding, {
      sourceTable: "bioEntries",
      sourceId: entryId,
    });

    const [row] = await t.run(async (ctx) =>
      ctx.db
        .query("contentEmbeddings")
        .withIndex("by_sourceTable_and_sourceId", (q) =>
          q.eq("sourceTable", "bioEntries").eq("sourceId", entryId),
        )
        .take(1),
    );
    expect(row).toBeDefined();

    const chunks = await t.query(internal.embeddings.queries.fetchChunksByIds, {
      ids: [row!._id],
    });

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({
      id: row!._id,
      sourceTable: "bioEntries",
      sourceId: entryId,
      title: "Design Engineer at Delphi",
    });
    expect(chunks[0]!.slug).toBeUndefined();
  });

  it("Issue C1: generateEmbedding still gates draft articles (regression guard)", async () => {
    const t = makeT();
    const ownerId = await insertOwner(t, "draft_user");

    // Pre-existing chunk that should be deleted by the gate.
    await t.run(async (ctx) =>
      ctx.db.insert("contentEmbeddings", {
        sourceTable: "articles",
        sourceId: "stale_id",
        userId: ownerId,
        chunkIndex: 0,
        chunkText: "stale",
        title: "stale",
        slug: "stale",
        embedding: new Array(768).fill(0),
        embeddingModel: "test",
        embeddedAt: 0,
      }),
    );

    const articleId = await t.run(async (ctx) =>
      ctx.db.insert("articles", {
        userId: ownerId,
        slug: "drafty",
        title: "Drafty",
        category: "blog",
        body: { type: "doc", content: [] },
        status: "draft",
        createdAt: Date.now(),
      }),
    );

    await t.action(internal.embeddings.actions.generateEmbedding, {
      sourceTable: "articles",
      sourceId: articleId,
    });

    // No chunk was inserted for the draft article (gate deleted any
    // existing rows for this sourceTable/sourceId pair).
    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("contentEmbeddings")
        .withIndex("by_sourceTable_and_sourceId", (q) =>
          q.eq("sourceTable", "articles").eq("sourceId", articleId),
        )
        .collect(),
    );
    expect(rows.length).toBe(0);
  });

  // Issue I5: scheduling generateEmbedding with each indexable source table
  // must not throw a validator error — catches a missed update at any of
  // the call sites that adopted `embeddingSourceTableValidator`.
  it.each(["articles", "posts", "bioEntries", "contactEntries"] as const)(
    "Issue I5: generateEmbedding accepts sourceTable=%s without validator rejection",
    async (sourceTable) => {
      const t = makeT();
      const ownerId = await insertOwner(t, `i5_${sourceTable}`);

      // Insert a real source row so the action has something to consume.
      // Use a sourceId that resolves to a real document — generateEmbedding
      // would otherwise fall through harmlessly via deleteBySource on the
      // null branch, which still validates the args path.
      let sourceId: string;
      if (sourceTable === "bioEntries") {
        sourceId = await t.run(async (ctx) =>
          ctx.db.insert("bioEntries", {
            userId: ownerId,
            kind: "work",
            title: "i5-bio",
            startDate: utcMonth(2020, 1),
            endDate: null,
          }),
        );
      } else if (sourceTable === "contactEntries") {
        sourceId = await t.run(async (ctx) =>
          ctx.db.insert("contactEntries", {
            userId: ownerId,
            kind: "email",
            value: `i5-${ownerId}@example.com`,
          }),
        );
      } else if (sourceTable === "articles") {
        sourceId = await t.run(async (ctx) =>
          ctx.db.insert("articles", {
            userId: ownerId,
            slug: `i5-art-${ownerId}`,
            title: "i5-art",
            category: "blog",
            body: { type: "doc", content: [] },
            status: "published",
            createdAt: Date.now(),
          }),
        );
      } else {
        sourceId = await t.run(async (ctx) =>
          ctx.db.insert("posts", {
            userId: ownerId,
            slug: `i5-post-${ownerId}`,
            title: "i5-post",
            category: "general",
            body: { type: "doc", content: [] },
            status: "published",
            createdAt: Date.now(),
          }),
        );
      }

      await t.action(internal.embeddings.actions.generateEmbedding, {
        sourceTable,
        sourceId,
      });

      // No throw → validator accepted the literal at every call site.
      // Sanity — at least one chunk was written.
      const rows = await t.run(async (ctx) =>
        ctx.db
          .query("contentEmbeddings")
          .withIndex("by_sourceTable_and_sourceId", (q) =>
            q.eq("sourceTable", sourceTable).eq("sourceId", sourceId),
          )
          .collect(),
      );
      expect(rows.length).toBeGreaterThan(0);
    },
  );

  // FR-14 / NFR-01 — verifies the embedding row carries the same userId as
  // the source; the chat-side filter does the rest.
  it("FR-14: bio embedding row's userId matches the entry's userId", async () => {
    const t = makeT();
    const userA = await insertOwner(t, "user_a");
    const userB = await insertOwner(t, "user_b");

    const entryA = await t.run(async (ctx) =>
      ctx.db.insert("bioEntries", {
        userId: userA,
        kind: "work",
        title: "A's role",
        startDate: utcMonth(2022, 1),
        endDate: null,
      }),
    );
    const entryB = await t.run(async (ctx) =>
      ctx.db.insert("bioEntries", {
        userId: userB,
        kind: "work",
        title: "B's role",
        startDate: utcMonth(2022, 1),
        endDate: null,
      }),
    );

    await t.action(internal.embeddings.actions.generateEmbedding, {
      sourceTable: "bioEntries",
      sourceId: entryA,
    });
    await t.action(internal.embeddings.actions.generateEmbedding, {
      sourceTable: "bioEntries",
      sourceId: entryB,
    });

    const rowsA = await t.run(async (ctx) =>
      ctx.db
        .query("contentEmbeddings")
        .withIndex("by_userId", (q) => q.eq("userId", userA))
        .collect(),
    );
    const rowsB = await t.run(async (ctx) =>
      ctx.db
        .query("contentEmbeddings")
        .withIndex("by_userId", (q) => q.eq("userId", userB))
        .collect(),
    );
    expect(rowsA.map((r) => r.title)).toEqual(["A's role"]);
    expect(rowsB.map((r) => r.title)).toEqual(["B's role"]);
  });

  // FG_228 — replaceChunksForSource atomicity
  //
  // True concurrent execution cannot be simulated with the convex-test harness:
  // `convexTest` is single-threaded and mutations are dispatched sequentially,
  // so interleaving two transactions is not possible in this environment.
  //
  // Instead we verify the structural invariant that is the basis of the fix:
  // calling replaceChunksForSource a second time for the same sourceId yields
  // exactly the new set of rows — no duplicates, no stale rows — which is the
  // property that prevents the A.delete→B.delete→A.insert→B.insert
  // interleave from occurring in production (because each call is one
  // transaction, making "last writer wins" the worst outcome rather than
  // "both writers add rows").
  it("FG_228: replaceChunksForSource on a second call yields exactly the new set (no duplicates, no stale rows)", async () => {
    const t = makeT();
    const ownerId = await insertOwner(t, "replace_atomicity");

    const entryId = await t.run(async (ctx) =>
      ctx.db.insert("bioEntries", {
        userId: ownerId,
        kind: "work",
        title: "Software Engineer",
        startDate: Date.UTC(2022, 0, 1),
        endDate: null,
      }),
    );

    const makeChunk = (
      sourceId: string,
      chunkIndex: number,
      chunkText: string,
    ) => ({
      sourceTable: "bioEntries" as const,
      sourceId,
      userId: ownerId,
      userSourceKey: buildEmbeddingUserSourceKey(ownerId, "bioEntries"),
      chunkIndex,
      chunkText,
      title: "Software Engineer",
      slug: undefined,
      embedding: new Array(768).fill(0.01) as number[],
      embeddingModel: "text-embedding-004",
      embeddedAt: Date.now(),
    });

    // First replace — simulates job A completing.
    await t.mutation(internal.embeddings.mutations.replaceChunksForSource, {
      sourceTable: "bioEntries",
      sourceId: entryId,
      chunks: [makeChunk(entryId, 0, "first-generation chunk")],
    });

    const afterFirst = await t.run(async (ctx) =>
      ctx.db
        .query("contentEmbeddings")
        .withIndex("by_sourceTable_and_sourceId", (q) =>
          q.eq("sourceTable", "bioEntries").eq("sourceId", entryId),
        )
        .collect(),
    );
    expect(afterFirst).toHaveLength(1);
    expect(afterFirst[0]!.chunkText).toBe("first-generation chunk");

    // Second replace — simulates job B (same sourceId, updated content).
    await t.mutation(internal.embeddings.mutations.replaceChunksForSource, {
      sourceTable: "bioEntries",
      sourceId: entryId,
      chunks: [
        makeChunk(entryId, 0, "second-generation chunk 0"),
        makeChunk(entryId, 1, "second-generation chunk 1"),
      ],
    });

    const afterSecond = await t.run(async (ctx) =>
      ctx.db
        .query("contentEmbeddings")
        .withIndex("by_sourceTable_and_sourceId", (q) =>
          q.eq("sourceTable", "bioEntries").eq("sourceId", entryId),
        )
        .collect(),
    );

    // Exactly 2 rows — old row was deleted before new rows were inserted.
    // If the old two-mutation approach had been used and interleaved, we would
    // see 3 rows (1 stale + 2 new) or 2 stale rows with 0 new ones.
    expect(afterSecond).toHaveLength(2);
    const texts = afterSecond.map((r) => r.chunkText).sort();
    expect(texts).toEqual([
      "second-generation chunk 0",
      "second-generation chunk 1",
    ]);
  });
});
