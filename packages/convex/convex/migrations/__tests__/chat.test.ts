/// <reference types="vite/client" />

// Set required env vars BEFORE any Convex module is imported. `convex/env.ts`
// validates these at module-load time and throws otherwise.
process.env.SITE_URL = process.env.SITE_URL ?? "https://test.local";
process.env.GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ?? "test-google-client-id";
process.env.GOOGLE_CLIENT_SECRET =
  process.env.GOOGLE_CLIENT_SECRET ?? "test-google-client-secret";

import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import { internal } from "../../_generated/api";
import schema from "../../schema";

// Stub modules that are transitively imported but not exercised by migration
// tests. The migration accesses `ctx.db` directly — no auth, no agent, no AI.

vi.mock("@convex-dev/agent", () => ({
  Agent: class {
    async continueThread() {
      return { thread: { streamText: async () => undefined } };
    }
  },
  createThread: async () => "thread_stub",
  saveMessage: async () => ({ messageId: "msg_stub" }),
  listMessages: async () => ({ page: [], isDone: true, continueCursor: "" }),
  createTool: (def: unknown) => def,
}));

vi.mock("ai", () => ({
  embed: async () => {
    throw new Error("embed stubbed");
  },
  stepCountIs: (count: number) =>
    ({ steps }: { steps: unknown[] }) =>
      steps.length === count,
}));

vi.mock("@ai-sdk/google", () => ({
  google: { textEmbeddingModel: () => ({}) },
}));

vi.mock("../../auth/client", () => ({
  authComponent: {
    safeGetAuthUser: async () => null,
    getAuthUser: async () => {
      throw new Error("Not authenticated");
    },
  },
}));

import { vi } from "vitest";

// ---------------------------------------------------------------------------
// Module-map normalizer — same pattern as other convex-test suites.
// Keys from `import.meta.glob` are relative to THIS file; convex-test needs
// them rooted at `convex/` so the path matches what `_generated/api.ts`
// expects.
// ---------------------------------------------------------------------------

function normalizeConvexGlob(
  raw: Record<string, () => Promise<unknown>>,
): Record<string, () => Promise<unknown>> {
  const out: Record<string, () => Promise<unknown>> = {};
  for (const [key, loader] of Object.entries(raw)) {
    let k = key;
    if (k.startsWith("./")) {
      k = "../../migrations/__tests__/" + k.slice(2);
    } else if (k.startsWith("../") && !k.startsWith("../../")) {
      k = "../../migrations/" + k.slice(3);
    }
    out[k] = loader;
  }

  // Replace the embedding actions/mutations with no-ops so CRUD tests don't
  // accidentally run the RAG pipeline through `runAfter(0)`.
  out["../../embeddings/actions.ts"] = async () => ({
    generateEmbedding: {
      handler: async () => null,
    },
    backfillEmbeddings: {
      handler: async () => null,
    },
  });
  out["../../embeddings/mutations.ts"] = async () => ({
    deleteBySource: {
      handler: async () => null,
    },
    insertChunks: {
      handler: async () => null,
    },
  });

  return out;
}

const rawModules = import.meta.glob("../../**/*.{ts,js}");
const modules = normalizeConvexGlob(rawModules);

function makeT() {
  return convexTest(schema, modules);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Insert a minimal `users` row (required FK for conversations). */
async function insertUser(t: ReturnType<typeof makeT>, authId: string) {
  return t.run(async (ctx) =>
    ctx.db.insert("users", {
      authId,
      email: `${authId}@example.com`,
      onboardingComplete: true,
    }),
  );
}

/**
 * Insert a conversation row.
 * When `mode` is omitted the row is written without the field, simulating a
 * legacy pre-backfill row.
 */
async function insertConversation(
  t: ReturnType<typeof makeT>,
  profileOwnerId: Awaited<ReturnType<typeof insertUser>>,
  options: { mode?: "clone" | "configuration"; threadSuffix?: string } = {},
) {
  return t.run(async (ctx) =>
    ctx.db.insert("conversations", {
      profileOwnerId,
      viewerId: undefined,
      mode: options.mode,
      threadId: `thread_${options.threadSuffix ?? String(Math.random())}`,
      status: "active",
      title: "seed",
    }),
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("backfillConversationMode migration", () => {
  // -------------------------------------------------------------------------
  // Cursor chaining — advancing through all rows with limit < total
  // -------------------------------------------------------------------------

  it("chains cursors to patch all 5 rows with limit=2", async () => {
    const t = makeT();
    const ownerId = await insertUser(t, "auth_cursor_owner");

    // Insert 5 conversations without `mode` (legacy rows).
    const ids = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        insertConversation(t, ownerId, { threadSuffix: `cursor_${i}` }),
      ),
    );

    // Chain invocations with limit=2 until isDone.
    let cursor: string | null = null;
    let totalScanned = 0;
    let totalPatched = 0;
    let iterations = 0;

    while (true) {
      const result = await t.mutation(
        internal.migrations.chat.backfillConversationMode,
        { dryRun: false, limit: 2, cursor: cursor ?? undefined },
      );

      totalScanned += result.scanned;
      totalPatched += result.patched;
      iterations += 1;

      if (result.isDone) {
        cursor = null;
        break;
      }
      cursor = result.continueCursor;

      // Safety guard: 5 rows with limit=2 should never need more than 3 pages.
      if (iterations > 10) {
        throw new Error("Cursor chaining did not terminate in time");
      }
    }

    expect(totalScanned).toBe(5);
    expect(totalPatched).toBe(5);

    // Verify every row now has mode="clone" in the DB.
    const rows = await t.run(async (ctx) =>
      Promise.all(ids.map((id) => ctx.db.get(id))),
    );
    for (const row of rows) {
      expect(row?.mode).toBe("clone");
    }
  });

  // -------------------------------------------------------------------------
  // Idempotency — second real run reports patched=0 and isDone=true
  // -------------------------------------------------------------------------

  it("is idempotent: second dryRun=false run reports patched=0 and isDone=true", async () => {
    const t = makeT();
    const ownerId = await insertUser(t, "auth_idempotent_owner");

    // Insert 3 legacy rows.
    await Promise.all(
      Array.from({ length: 3 }, (_, i) =>
        insertConversation(t, ownerId, { threadSuffix: `idem_${i}` }),
      ),
    );

    // First full run — patches everything.
    const first = await t.mutation(
      internal.migrations.chat.backfillConversationMode,
      { dryRun: false, limit: 10 },
    );
    expect(first.patched).toBe(3);
    expect(first.isDone).toBe(true);

    // Second run — all rows already have mode; nothing to patch.
    const second = await t.mutation(
      internal.migrations.chat.backfillConversationMode,
      { dryRun: false, limit: 10 },
    );
    expect(second.patched).toBe(0);
    expect(second.isDone).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Dry-run vs real-run accuracy
  // -------------------------------------------------------------------------

  it("dryRun=true scans rows without patching; dryRun=false patches them", async () => {
    const t = makeT();
    const ownerId = await insertUser(t, "auth_dryrun_owner");

    // Insert 4 legacy rows.
    const ids = await Promise.all(
      Array.from({ length: 4 }, (_, i) =>
        insertConversation(t, ownerId, { threadSuffix: `dry_${i}` }),
      ),
    );

    // Dry-run pass: should report scanned and patched counts but leave DB unchanged.
    const dryResult = await t.mutation(
      internal.migrations.chat.backfillConversationMode,
      { dryRun: true, limit: 10 },
    );
    expect(dryResult.dryRun).toBe(true);
    expect(dryResult.scanned).toBe(4);
    expect(dryResult.patched).toBe(4);
    expect(dryResult.isDone).toBe(true);

    // Rows must still have mode=undefined after the dry run.
    const afterDry = await t.run(async (ctx) =>
      Promise.all(ids.map((id) => ctx.db.get(id))),
    );
    for (const row of afterDry) {
      expect(row?.mode).toBeUndefined();
    }

    // Real run: should now actually write mode="clone".
    const realResult = await t.mutation(
      internal.migrations.chat.backfillConversationMode,
      { dryRun: false, limit: 10 },
    );
    expect(realResult.dryRun).toBe(false);
    expect(realResult.scanned).toBe(4);
    expect(realResult.patched).toBe(4);
    expect(realResult.isDone).toBe(true);

    // Rows must now have mode="clone".
    const afterReal = await t.run(async (ctx) =>
      Promise.all(ids.map((id) => ctx.db.get(id))),
    );
    for (const row of afterReal) {
      expect(row?.mode).toBe("clone");
    }
  });

  // -------------------------------------------------------------------------
  // Rows that already have mode set are skipped (patched count excludes them)
  // -------------------------------------------------------------------------

  it("skips rows that already have a mode value", async () => {
    const t = makeT();
    const ownerId = await insertUser(t, "auth_skip_owner");

    // 2 legacy rows (mode=undefined) + 2 already-patched rows.
    await insertConversation(t, ownerId, { threadSuffix: "skip_legacy_0" });
    await insertConversation(t, ownerId, { threadSuffix: "skip_legacy_1" });
    await insertConversation(t, ownerId, {
      mode: "clone",
      threadSuffix: "skip_patched_0",
    });
    await insertConversation(t, ownerId, {
      mode: "clone",
      threadSuffix: "skip_patched_1",
    });

    const result = await t.mutation(
      internal.migrations.chat.backfillConversationMode,
      { dryRun: false, limit: 10 },
    );

    expect(result.scanned).toBe(4);
    expect(result.patched).toBe(2);
    expect(result.isDone).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Default dryRun=true is preserved
  // -------------------------------------------------------------------------

  it("defaults to dryRun=true and does not patch rows", async () => {
    const t = makeT();
    const ownerId = await insertUser(t, "auth_default_owner");

    const id = await insertConversation(t, ownerId, {
      threadSuffix: "default_dryrun",
    });

    const result = await t.mutation(
      internal.migrations.chat.backfillConversationMode,
      { limit: 10 },
      // No dryRun arg — default must be true.
    );
    expect(result.dryRun).toBe(true);
    expect(result.patched).toBe(1);

    // Row must be unchanged.
    const row = await t.run(async (ctx) => ctx.db.get(id));
    expect(row?.mode).toBeUndefined();
  });
});
