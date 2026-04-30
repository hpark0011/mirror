/// <reference types="vite/client" />

process.env.SITE_URL = process.env.SITE_URL ?? "https://test.local";
process.env.GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ?? "test-google-client-id";
process.env.GOOGLE_CLIENT_SECRET =
  process.env.GOOGLE_CLIENT_SECRET ?? "test-google-client-secret";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../schema";

// Shared mutable state for module mocks.
const authState = {
  currentAuthUser: null as { _id: string } | null,
};

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
          thread: {
            streamText: vi.fn(async () => undefined),
          },
        };
      }
    },
  };
});

vi.mock("ai", () => {
  return {
    embed: vi.fn(async () => {
      throw new Error("embed stubbed");
    }),
    // Return one fake 768-dim vector per input chunk so the
    // generateEmbedding action's downstream insertChunks runs (one chunk
    // in, one row out). Tests that schedule generateEmbedding rely on
    // this to observe the contentEmbeddings row contract end-to-end.
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
      safeGetAuthUser: vi.fn(async () => authState.currentAuthUser),
      // `authMutation` calls `getAuthUser` (not `safeGetAuthUser`) and
      // throws if it returns nullish. Stub both with the same backing
      // state so tests can flip a single switch.
      getAuthUser: vi.fn(async () => {
        if (!authState.currentAuthUser) {
          throw new Error("Not authenticated");
        }
        return authState.currentAuthUser;
      }),
    },
  };
});

import { api } from "../../_generated/api";

function normalizeConvexGlob(
  raw: Record<string, () => Promise<unknown>>,
): Record<string, () => Promise<unknown>> {
  const out: Record<string, () => Promise<unknown>> = {};
  for (const [key, loader] of Object.entries(raw)) {
    let k = key;
    if (k.startsWith("./")) {
      k = "../../bio/__tests__/" + k.slice(2);
    } else if (k.startsWith("../") && !k.startsWith("../../")) {
      k = "../../bio/" + k.slice(3);
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

/**
 * Inserts a `users` row and flips `authState.currentAuthUser` so the
 * mocked `authComponent.getAuthUser` resolves the same authId. Returns
 * the app `users` Id.
 */
async function signInAs(
  t: ReturnType<typeof makeT>,
  authId: string,
  username = `u_${authId}`,
) {
  const userId = await t.run(async (ctx) =>
    ctx.db.insert("users", {
      authId,
      email: `${authId}@example.com`,
      username,
      onboardingComplete: true,
    }),
  );
  authState.currentAuthUser = { _id: authId };
  return userId;
}

describe("bio.mutations.create (FR-05, FR-11, FR-12, NFR-05)", () => {
  beforeEach(() => {
    authState.currentAuthUser = null;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects when not authenticated", async () => {
    const t = makeT();
    await expect(
      t.mutation(api.bio.mutations.create, {
        kind: "work",
        title: "Engineer",
        startDate: utcMonth(2022, 1),
        endDate: null,
      }),
    ).rejects.toThrow();
  });

  it("inserts row with userId from auth context (never client) and schedules generateEmbedding", async () => {
    const t = makeT();
    const ownerId = await signInAs(t, "auth_owner_create", "owner_create");

    const id = await t.mutation(api.bio.mutations.create, {
      kind: "work",
      title: "Senior Engineer at Acme",
      startDate: utcMonth(2022, 1),
      endDate: utcMonth(2024, 3),
      description: "Built things",
      link: "https://acme.com",
    });
    expect(id).toBeDefined();

    const row = await t.run(async (ctx) => ctx.db.get(id));
    expect(row).not.toBeNull();
    expect(row!.userId).toBe(ownerId);
    expect(row!.kind).toBe("work");
    expect(row!.title).toBe("Senior Engineer at Acme");

    // Embedding scheduling — the action's mock chain stops at the embed
    // call, but the scheduler.runAfter MUST have queued. convex-test
    // makes scheduled functions observable via finishAllScheduledFunctions.
    // Here we just assert the row was created; deeper scheduling
    // verification is covered in embeddings/__tests__/bio-source.test.ts.
  });

  it("FR-11: create's args validator does NOT include userId — extra arg is rejected", async () => {
    const t = makeT();
    await signInAs(t, "auth_owner_no_user_arg");

    // Spread an extra `userId` field — the validator must reject it.
    // (Convex's extra-arg policy: `v.object` validators accept exactly the
    // declared fields and fail on anything extra at the public boundary.)
    //
    // Locked regex matches the exact Convex validator-rejection wording —
    // "Validator error: Unexpected field `userId` in object" — so a future
    // handler bug throwing for any other reason (e.g., "Bio entry not
    // found", auth error) cannot vacuously pass this test.
    await expect(
      t.mutation(api.bio.mutations.create, {
        kind: "work",
        title: "Hax",
        startDate: utcMonth(2022, 1),
        endDate: null,
        // @ts-expect-error — intentionally an unknown arg
        userId: "users:abc",
      }),
    ).rejects.toThrow(/Validator error.*Unexpected field.*userId/);
  });

  it("rejects empty title", async () => {
    const t = makeT();
    await signInAs(t, "auth_empty_title");
    await expect(
      t.mutation(api.bio.mutations.create, {
        kind: "work",
        title: "   ",
        startDate: utcMonth(2022, 1),
        endDate: null,
      }),
    ).rejects.toThrow(/title is required/i);
  });

  it("rejects title > 200 chars", async () => {
    const t = makeT();
    await signInAs(t, "auth_long_title");
    await expect(
      t.mutation(api.bio.mutations.create, {
        kind: "work",
        title: "x".repeat(201),
        startDate: utcMonth(2022, 1),
        endDate: null,
      }),
    ).rejects.toThrow(/title exceeds maximum length/i);
  });

  it("rejects description > 500 chars", async () => {
    const t = makeT();
    await signInAs(t, "auth_long_desc");
    await expect(
      t.mutation(api.bio.mutations.create, {
        kind: "work",
        title: "ok",
        startDate: utcMonth(2022, 1),
        endDate: null,
        description: "x".repeat(501),
      }),
    ).rejects.toThrow(/description exceeds maximum length/i);
  });

  it("rejects endDate before startDate", async () => {
    const t = makeT();
    await signInAs(t, "auth_bad_range");
    await expect(
      t.mutation(api.bio.mutations.create, {
        kind: "work",
        title: "Engineer",
        startDate: utcMonth(2024, 6),
        endDate: utcMonth(2022, 1),
      }),
    ).rejects.toThrow(/endDate/);
  });

  it("NFR-05: two SEQUENTIAL creates at count=49 — first succeeds, second rejects", async () => {
    const t = makeT();
    await signInAs(t, "auth_softcap", "softcap");

    // Pre-seed 49 entries directly (faster than 49 mutations).
    const ownerId = await t.run(async (ctx) => {
      const row = await ctx.db
        .query("users")
        .withIndex("by_authId", (q) => q.eq("authId", "auth_softcap"))
        .unique();
      const id = row!._id;
      for (let i = 0; i < 49; i++) {
        await ctx.db.insert("bioEntries", {
          userId: id,
          kind: "work",
          title: `seed-${i}`,
          startDate: utcMonth(2020, 1) + i,
          endDate: null,
        });
      }
      return id;
    });
    expect(ownerId).toBeDefined();

    // 50th create — succeeds (count was 49 BEFORE).
    await t.mutation(api.bio.mutations.create, {
      kind: "work",
      title: "fiftieth",
      startDate: utcMonth(2024, 1),
      endDate: null,
    });

    // 51st create — must reject. Per the convex-test in-process serialized
    // model these run sequentially, which is what we explicitly test
    // (cross-process race is a documented untested edge per NFR-05).
    await expect(
      t.mutation(api.bio.mutations.create, {
        kind: "work",
        title: "fiftyfirst",
        startDate: utcMonth(2024, 6),
        endDate: null,
      }),
    ).rejects.toThrow(/limit reached/i);
  });
});

describe("bio.mutations.update (FR-05, FR-07)", () => {
  beforeEach(() => {
    authState.currentAuthUser = null;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("patches only changed fields and re-triggers embedding", async () => {
    // `t.finishAllScheduledFunctions(advanceTimers, ...)` requires fake
    // timers — see convex-test/dist/index.js:1701. We need it to drain
    // the create-scheduled and update-scheduled `generateEmbedding`
    // actions so the post-update assertion can compare chunk text
    // against the *patched* title.
    vi.useFakeTimers();

    const t = makeT();
    const ownerId = await signInAs(t, "auth_update_owner", "u_update_owner");

    const id = await t.mutation(api.bio.mutations.create, {
      kind: "work",
      title: "Engineer",
      startDate: utcMonth(2020, 1),
      endDate: utcMonth(2024, 1),
      description: "original desc",
      link: "https://before.com",
    });

    // Run the create-scheduled embedding so the post-update assertion can
    // distinguish "embedding row reflects the patched title" from "an old
    // pre-update row happens to be present."
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    await t.mutation(api.bio.mutations.update, {
      id,
      title: "Senior Engineer",
    });

    const row = await t.run(async (ctx) => ctx.db.get(id));
    expect(row!.title).toBe("Senior Engineer");
    // Unchanged fields must be preserved.
    expect(row!.description).toBe("original desc");
    expect(row!.link).toBe("https://before.com");
    expect(row!.startDate).toBe(utcMonth(2020, 1));
    expect(row!.endDate).toBe(utcMonth(2024, 1));
    expect(row!.userId).toBe(ownerId);

    // FR-07 second half — verify update *re-triggered* the embedding pipeline.
    // If the scheduler.runAfter call were removed from the update handler,
    // the contentEmbeddings row would still reflect the pre-update title
    // ("Engineer"), not the patched one ("Senior Engineer").
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const chunks = await t.run(async (ctx) =>
      ctx.db
        .query("contentEmbeddings")
        .withIndex("by_sourceTable_and_sourceId", (q) =>
          q.eq("sourceTable", "bioEntries").eq("sourceId", id),
        )
        .collect(),
    );
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    // The chunk's chunkText is produced from the (patched) bio entry, so it
    // must contain the new title — not the original.
    expect(chunks[0]!.chunkText).toContain("Senior Engineer");
    expect(chunks[0]!.chunkText).not.toMatch(/Worked as Engineer\b/);
    // The display title also reflects the patched value.
    expect(chunks[0]!.title).toBe("Senior Engineer");
    // Bio chunks have no slug — guards iter2-Finding1 / C2.
    expect(chunks[0]!.slug).toBeUndefined();
    expect(chunks[0]!.userId).toBe(ownerId);
  });

  it("FR-05: rejects update by a non-owner", async () => {
    const t = makeT();

    // Owner creates an entry.
    await signInAs(t, "auth_update_real_owner", "u_real_owner");
    const id = await t.mutation(api.bio.mutations.create, {
      kind: "work",
      title: "Engineer",
      startDate: utcMonth(2022, 1),
      endDate: null,
    });

    // Switch to a different signed-in user.
    await signInAs(t, "auth_update_attacker", "u_attacker");

    await expect(
      t.mutation(api.bio.mutations.update, {
        id,
        title: "Hijacked",
      }),
    ).rejects.toThrow(/not authorized/i);
  });

  it("rejects bad date range on update", async () => {
    const t = makeT();
    await signInAs(t, "auth_update_bad_range", "u_bad_range");
    const id = await t.mutation(api.bio.mutations.create, {
      kind: "work",
      title: "Engineer",
      startDate: utcMonth(2020, 1),
      endDate: utcMonth(2024, 1),
    });

    await expect(
      t.mutation(api.bio.mutations.update, {
        id,
        endDate: utcMonth(2018, 1), // earlier than startDate (2020)
      }),
    ).rejects.toThrow(/endDate/);
  });
});

describe("bio.mutations.remove (FR-05, FR-08)", () => {
  beforeEach(() => {
    authState.currentAuthUser = null;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("deletes the row and schedules deleteBySource", async () => {
    // `t.finishAllScheduledFunctions(advanceTimers, ...)` requires fake
    // timers (convex-test/dist/index.js:1701). Needed to drain the
    // create-scheduled generateEmbedding (so a real chunk exists to be
    // deleted) and the remove-scheduled deleteBySource.
    vi.useFakeTimers();

    const t = makeT();
    await signInAs(t, "auth_remove_owner", "u_remove_owner");

    const id = await t.mutation(api.bio.mutations.create, {
      kind: "work",
      title: "Engineer",
      startDate: utcMonth(2022, 1),
      endDate: null,
    });

    // Let the create-scheduled generateEmbedding run so we have a real
    // contentEmbeddings row that `remove` is supposed to clean up. This is
    // the FR-08 invariant: "after remove, BOTH the bioEntries row AND its
    // matching contentEmbeddings rows are gone."
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const beforeChunks = await t.run(async (ctx) =>
      ctx.db
        .query("contentEmbeddings")
        .withIndex("by_sourceTable_and_sourceId", (q) =>
          q.eq("sourceTable", "bioEntries").eq("sourceId", id),
        )
        .collect(),
    );
    // Sanity — the create path must have produced at least one chunk;
    // otherwise the post-remove assertion would pass vacuously.
    expect(beforeChunks.length).toBeGreaterThanOrEqual(1);

    await t.mutation(api.bio.mutations.remove, { id });

    const row = await t.run(async (ctx) => ctx.db.get(id));
    expect(row).toBeNull();

    // Run the deleteBySource scheduled by the remove handler.
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const afterChunks = await t.run(async (ctx) =>
      ctx.db
        .query("contentEmbeddings")
        .withIndex("by_sourceTable_and_sourceId", (q) =>
          q.eq("sourceTable", "bioEntries").eq("sourceId", id),
        )
        .collect(),
    );
    // FR-08: deleteBySource cleared every chunk for this (sourceTable, sourceId).
    expect(afterChunks.length).toBe(0);
  });

  it("FR-05: rejects remove by a non-owner", async () => {
    const t = makeT();

    await signInAs(t, "auth_remove_real_owner", "u_real_remove_owner");
    const id = await t.mutation(api.bio.mutations.create, {
      kind: "work",
      title: "Engineer",
      startDate: utcMonth(2022, 1),
      endDate: null,
    });

    await signInAs(t, "auth_remove_attacker", "u_remove_attacker");
    await expect(
      t.mutation(api.bio.mutations.remove, { id }),
    ).rejects.toThrow(/not authorized/i);

    // Sanity — the row is still there.
    const row = await t.run(async (ctx) => ctx.db.get(id));
    expect(row).not.toBeNull();
  });
});
