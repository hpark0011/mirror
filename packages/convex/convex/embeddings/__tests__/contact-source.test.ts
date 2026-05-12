/// <reference types="vite/client" />

process.env.SITE_URL = process.env.SITE_URL ?? "https://test.local";
process.env.GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ?? "test-google-client-id";
process.env.GOOGLE_CLIENT_SECRET =
  process.env.GOOGLE_CLIENT_SECRET ?? "test-google-client-secret";

import { beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../schema";

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

describe("embeddings: contact source", () => {
  beforeEach(() => {
    embeddingsState.embedManyCalls = 0;
    embeddingsState.lastValues = [];
  });

  it("getContentForEmbedding returns kind:'contact' for a contactEntries source", async () => {
    const t = makeT();
    const ownerId = await insertOwner(t, "contact_user");

    const entryId = await t.run(async (ctx) =>
      ctx.db.insert("contactEntries", {
        userId: ownerId,
        kind: "email",
        value: "hpark0011@gmail.com",
      }),
    );

    const content = await t.query(
      internal.embeddings.queries.getContentForEmbedding,
      { sourceTable: "contactEntries", sourceId: entryId },
    );
    expect(content).not.toBeNull();
    expect(content!.kind).toBe("contact");
    if (content!.kind !== "contact") throw new Error("type-narrow");
    expect(content.body).toBe("Email address: hpark0011@gmail.com.");
    expect(content.userId).toBe(ownerId);
  });

  it("generateEmbedding writes one chunk with no slug for contact entries", async () => {
    const t = makeT();
    const ownerId = await insertOwner(t, "contact_embed");

    const entryId = await t.run(async (ctx) =>
      ctx.db.insert("contactEntries", {
        userId: ownerId,
        kind: "linkedin",
        value: "https://www.linkedin.com/in/hyunsolpark/",
      }),
    );

    await t.action(internal.embeddings.actions.generateEmbedding, {
      sourceTable: "contactEntries",
      sourceId: entryId,
    });

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("contentEmbeddings")
        .withIndex("by_sourceTable_and_sourceId", (q) =>
          q.eq("sourceTable", "contactEntries").eq("sourceId", entryId),
        )
        .collect(),
    );
    expect(rows.length).toBe(1);
    const row = rows[0]!;
    expect(row.userId).toBe(ownerId);
    expect(row.chunkIndex).toBe(0);
    expect(row.slug).toBeUndefined();
    expect(row.userSourceKey).toBe(
      buildEmbeddingUserSourceKey(ownerId, "contactEntries"),
    );
    // The chunk's text is the serialized prose.
    expect(row.chunkText).toBe(
      "LinkedIn profile: https://www.linkedin.com/in/hyunsolpark/.",
    );
    // embedMany was invoked exactly once with one chunk.
    expect(embeddingsState.embedManyCalls).toBe(1);
    expect(embeddingsState.lastValues).toEqual([
      "LinkedIn profile: https://www.linkedin.com/in/hyunsolpark/.",
    ]);
  });

  it("generateEmbedding does NOT apply the published-status gate to contact entries", async () => {
    // Contact entries have lifecycle: "always-indexable" — same as bio.
    const t = makeT();
    const ownerId = await insertOwner(t, "contact_always");

    const entryId = await t.run(async (ctx) =>
      ctx.db.insert("contactEntries", {
        userId: ownerId,
        kind: "instagram",
        value: "https://www.instagram.com/hyunsolpark/",
      }),
    );

    await t.action(internal.embeddings.actions.generateEmbedding, {
      sourceTable: "contactEntries",
      sourceId: entryId,
    });

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("contentEmbeddings")
        .withIndex("by_sourceTable_and_sourceId", (q) =>
          q.eq("sourceTable", "contactEntries").eq("sourceId", entryId),
        )
        .collect(),
    );
    expect(rows.length).toBe(1);
  });

  it("generateEmbedding deletes stale rows when the source row is gone", async () => {
    const t = makeT();
    const ownerId = await insertOwner(t, "contact_missing");

    const entryId = await t.run(async (ctx) =>
      ctx.db.insert("contactEntries", {
        userId: ownerId,
        kind: "x",
        value: "https://x.com/hp",
      }),
    );

    await t.action(internal.embeddings.actions.generateEmbedding, {
      sourceTable: "contactEntries",
      sourceId: entryId,
    });

    // Delete the source then re-run — the action should observe the missing
    // source and delete the stale embedding row.
    await t.run(async (ctx) => ctx.db.delete(entryId));

    await t.action(internal.embeddings.actions.generateEmbedding, {
      sourceTable: "contactEntries",
      sourceId: entryId,
    });

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("contentEmbeddings")
        .withIndex("by_sourceTable_and_sourceId", (q) =>
          q.eq("sourceTable", "contactEntries").eq("sourceId", entryId),
        )
        .collect(),
    );
    expect(rows.length).toBe(0);
  });
});
