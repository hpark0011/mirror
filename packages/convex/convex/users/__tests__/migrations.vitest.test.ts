/// <reference types="vite/client" />

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
    embedMany: vi.fn(async () => ({ embeddings: [] })),
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
      k = "../../users/__tests__/" + k.slice(2);
    } else if (k.startsWith("../") && !k.startsWith("../../")) {
      k = "../../users/" + k.slice(3);
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

async function insertUserRaw(
  t: ReturnType<typeof makeT>,
  fields: {
    authId: string;
    email: string;
    username?: string;
    bio?: string;
    tagline?: string;
  },
) {
  return t.run(async (ctx) =>
    ctx.db.insert("users", {
      authId: fields.authId,
      email: fields.email,
      username: fields.username,
      ...(fields.bio !== undefined ? { bio: fields.bio } : {}),
      ...(fields.tagline !== undefined ? { tagline: fields.tagline } : {}),
      onboardingComplete: true,
    }),
  );
}

describe("users.migrations.backfillTaglineFromBio", () => {
  it("copies bio → tagline for a user that has bio set and tagline unset", async () => {
    const t = makeT();
    const id = await insertUserRaw(t, {
      authId: "auth_a",
      email: "a@example.com",
      username: "a",
      bio: "the bio text",
    });

    const result = await t.mutation(
      internal.users.migrations.backfillTaglineFromBio,
      {},
    );
    expect(result.updated).toBe(1);
    expect(result.skipped).toBe(0);

    const row = await t.run(async (ctx) => ctx.db.get(id));
    expect(row!.tagline).toBe("the bio text");
    // bio is preserved during C1; the C2 commit drops the field.
    expect(row!.bio).toBe("the bio text");
  });

  it("is idempotent — re-running leaves rows untouched", async () => {
    const t = makeT();
    const id = await insertUserRaw(t, {
      authId: "auth_b",
      email: "b@example.com",
      username: "b",
      bio: "stable text",
    });

    const first = await t.mutation(
      internal.users.migrations.backfillTaglineFromBio,
      {},
    );
    expect(first.updated).toBe(1);
    expect(first.skipped).toBe(0);

    const second = await t.mutation(
      internal.users.migrations.backfillTaglineFromBio,
      {},
    );
    // Second pass: the row already has tagline set, so it skips.
    expect(second.updated).toBe(0);
    expect(second.skipped).toBe(1);

    const row = await t.run(async (ctx) => ctx.db.get(id));
    expect(row!.tagline).toBe("stable text");
  });

  it("skips users whose tagline is already set (does not overwrite from bio)", async () => {
    const t = makeT();
    const id = await insertUserRaw(t, {
      authId: "auth_c",
      email: "c@example.com",
      username: "c",
      bio: "the old bio",
      tagline: "the new tagline",
    });

    const result = await t.mutation(
      internal.users.migrations.backfillTaglineFromBio,
      {},
    );
    expect(result.updated).toBe(0);
    expect(result.skipped).toBe(1);

    const row = await t.run(async (ctx) => ctx.db.get(id));
    // Tagline was preserved — the migration does not overwrite a set
    // tagline even if bio holds a different value.
    expect(row!.tagline).toBe("the new tagline");
  });

  it("skips users with no bio", async () => {
    const t = makeT();
    const id = await insertUserRaw(t, {
      authId: "auth_d",
      email: "d@example.com",
      username: "d",
    });

    const result = await t.mutation(
      internal.users.migrations.backfillTaglineFromBio,
      {},
    );
    expect(result.updated).toBe(0);
    expect(result.skipped).toBe(1);

    const row = await t.run(async (ctx) => ctx.db.get(id));
    expect(row!.tagline).toBeUndefined();
    expect(row!.bio).toBeUndefined();
  });

  it("skips users with empty-string bio", async () => {
    const t = makeT();
    const id = await insertUserRaw(t, {
      authId: "auth_e",
      email: "e@example.com",
      username: "e",
      bio: "",
    });

    const result = await t.mutation(
      internal.users.migrations.backfillTaglineFromBio,
      {},
    );
    expect(result.updated).toBe(0);
    expect(result.skipped).toBe(1);

    const row = await t.run(async (ctx) => ctx.db.get(id));
    expect(row!.tagline).toBeUndefined();
  });

  it("returns { updated, skipped } counts that sum to total users", async () => {
    const t = makeT();
    // Mix: 2 to update, 2 to skip (no bio + tagline already set).
    await insertUserRaw(t, {
      authId: "auth_x1",
      email: "x1@example.com",
      username: "x1",
      bio: "bio1",
    });
    await insertUserRaw(t, {
      authId: "auth_x2",
      email: "x2@example.com",
      username: "x2",
      bio: "bio2",
    });
    await insertUserRaw(t, {
      authId: "auth_x3",
      email: "x3@example.com",
      username: "x3",
    });
    await insertUserRaw(t, {
      authId: "auth_x4",
      email: "x4@example.com",
      username: "x4",
      bio: "old",
      tagline: "set",
    });

    const result = await t.mutation(
      internal.users.migrations.backfillTaglineFromBio,
      {},
    );
    expect(result.updated).toBe(2);
    expect(result.skipped).toBe(2);
    expect(result.updated + result.skipped).toBe(4);
  });
});
