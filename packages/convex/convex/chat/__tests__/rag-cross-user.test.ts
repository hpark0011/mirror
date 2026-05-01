/// <reference types="vite/client" />

// FR-14 NOTE — convex-test (^0.0.48) does NOT implement `ctx.vectorSearch`,
// so this file cannot exercise the actual `chat/actions.ts` retrieval call:
//
//   ctx.vectorSearch("contentEmbeddings", "by_embedding", {
//     vector,
//     filter: q.eq("userId", profileOwnerId),
//   })
//
// Instead, we verify the *same `userId` filter expression* at the index
// layer via `withIndex("by_userId", q.eq(...))`. The vector index's
// `filterFields: ["userId"]` (see `embeddings/schema.ts`) routes the
// runtime filter through the same column the index test exercises here —
// if cross-user isolation breaks at the index, it breaks at vector search,
// and vice versa.
//
// The real `vectorSearch` filter expression is exercised end-to-end by
// `apps/mirror/e2e/bio/bio-rag-cross-user.spec.ts` (Wave 4 — Playwright).
// That harness has a real Convex deployment and does support vectorSearch.

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

function normalizeConvexGlob(
  raw: Record<string, () => Promise<unknown>>,
): Record<string, () => Promise<unknown>> {
  const out: Record<string, () => Promise<unknown>> = {};
  for (const [key, loader] of Object.entries(raw)) {
    let k = key;
    if (k.startsWith("./")) {
      k = "../../chat/__tests__/" + k.slice(2);
    } else if (k.startsWith("../") && !k.startsWith("../../")) {
      k = "../../chat/" + k.slice(3);
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

/**
 * FR-14 / NFR-01 — vector retrieval is scoped to the target clone's owner.
 *
 * The chat retrieval call site (`chat/actions.ts`) wraps:
 *
 *   ctx.vectorSearch("contentEmbeddings", "by_embedding", {
 *     vector,
 *     filter: q.eq("userId", profileOwnerId),
 *   })
 *
 * `convex-test` does not implement vectorSearch, so we exercise the same
 * isolation guarantee at the *index* level: querying `contentEmbeddings`
 * via `by_userId` for user A must not return any rows owned by user B,
 * even when both have semantically similar content. This is the same
 * filter expression the vectorSearch uses — index-level coverage is the
 * load-bearing isolation barrier.
 */
describe("RAG cross-user isolation (FR-14, NFR-01)", () => {
  it("by_userId index returns only the queried user's chunks (semantically similar bio entries)", async () => {
    const t = makeT();
    const userA = await insertOwner(t, "user_a_iso");
    const userB = await insertOwner(t, "user_b_iso");

    // Both users have bio entries describing "Software Engineer at MIT"
    // — semantically similar. The isolation must hold regardless of
    // content.
    const entryA = await t.run(async (ctx) =>
      ctx.db.insert("bioEntries", {
        userId: userA,
        kind: "work",
        title: "Software Engineer at MIT",
        startDate: utcMonth(2020, 1),
        endDate: null,
      }),
    );
    const entryB = await t.run(async (ctx) =>
      ctx.db.insert("bioEntries", {
        userId: userB,
        kind: "work",
        title: "Software Engineer at MIT",
        startDate: utcMonth(2020, 1),
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

    // Query user A's chunks via the same filter expression
    // `vectorSearch.filter` uses.
    const aChunks = await t.run(async (ctx) =>
      ctx.db
        .query("contentEmbeddings")
        .withIndex("by_userId", (q) => q.eq("userId", userA))
        .collect(),
    );
    expect(aChunks.length).toBe(1);
    // None of A's chunks reference B's entry id.
    expect(aChunks.some((c) => c.sourceId === entryB)).toBe(false);
    expect(aChunks.every((c) => c.userId === userA)).toBe(true);

    const bChunks = await t.run(async (ctx) =>
      ctx.db
        .query("contentEmbeddings")
        .withIndex("by_userId", (q) => q.eq("userId", userB))
        .collect(),
    );
    expect(bChunks.length).toBe(1);
    expect(bChunks.some((c) => c.sourceId === entryA)).toBe(false);
    expect(bChunks.every((c) => c.userId === userB)).toBe(true);
  });

  it("by_userId filter excludes mixed source-table chunks belonging to other users", async () => {
    const t = makeT();
    const userA = await insertOwner(t, "user_a_mixed");
    const userB = await insertOwner(t, "user_b_mixed");

    // A: one bio entry. B: one bio entry + one article.
    const aBio = await t.run(async (ctx) =>
      ctx.db.insert("bioEntries", {
        userId: userA,
        kind: "work",
        title: "A's role",
        startDate: utcMonth(2020, 1),
        endDate: null,
      }),
    );
    const bBio = await t.run(async (ctx) =>
      ctx.db.insert("bioEntries", {
        userId: userB,
        kind: "education",
        title: "B's degree",
        startDate: utcMonth(2010, 9),
        endDate: utcMonth(2014, 5),
      }),
    );
    const bArticle = await t.run(async (ctx) =>
      ctx.db.insert("articles", {
        userId: userB,
        slug: "b-article",
        title: "B's Article",
        category: "blog",
        body: { type: "doc", content: [] },
        status: "published",
        createdAt: Date.now(),
      }),
    );

    await t.action(internal.embeddings.actions.generateEmbedding, {
      sourceTable: "bioEntries",
      sourceId: aBio,
    });
    await t.action(internal.embeddings.actions.generateEmbedding, {
      sourceTable: "bioEntries",
      sourceId: bBio,
    });
    await t.action(internal.embeddings.actions.generateEmbedding, {
      sourceTable: "articles",
      sourceId: bArticle,
    });

    const aChunks = await t.run(async (ctx) =>
      ctx.db
        .query("contentEmbeddings")
        .withIndex("by_userId", (q) => q.eq("userId", userA))
        .collect(),
    );
    // A sees only their own single chunk — B's bio AND B's article are
    // both filtered out.
    expect(aChunks.length).toBe(1);
    expect(aChunks[0]!.sourceId).toBe(aBio);

    const bChunks = await t.run(async (ctx) =>
      ctx.db
        .query("contentEmbeddings")
        .withIndex("by_userId", (q) => q.eq("userId", userB))
        .collect(),
    );
    expect(bChunks.length).toBe(2);
    expect(bChunks.every((c) => c.userId === userB)).toBe(true);
  });
});
