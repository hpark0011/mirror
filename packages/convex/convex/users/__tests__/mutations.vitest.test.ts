/// <reference types="vite/client" />

process.env.SITE_URL = process.env.SITE_URL ?? "https://test.local";
process.env.GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ?? "test-google-client-id";
process.env.GOOGLE_CLIENT_SECRET =
  process.env.GOOGLE_CLIENT_SECRET ?? "test-google-client-secret";

import { beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../schema";

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
      safeGetAuthUser: vi.fn(async () => authState.currentAuthUser),
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

describe("users.mutations.updateProfile (C1: writes tagline; bio is a deprecated alias)", () => {
  beforeEach(() => {
    authState.currentAuthUser = null;
  });

  it("rejects when not authenticated", async () => {
    const t = makeT();
    await expect(
      t.mutation(api.users.mutations.updateProfile, {
        tagline: "anything",
      }),
    ).rejects.toThrow();
  });

  it("writes tagline to the DB when called with { tagline }", async () => {
    const t = makeT();
    const userId = await signInAs(t, "auth_t1", "u_t1");

    await t.mutation(api.users.mutations.updateProfile, {
      tagline: "fresh tagline",
    });

    const row = await t.run(async (ctx) => ctx.db.get(userId));
    expect(row).not.toBeNull();
    expect(row!.tagline).toBe("fresh tagline");
    // The mutation MUST NOT touch the bio field — it is read-only at the
    // mutation boundary in C1 and removed entirely in C2.
    expect(row!.bio).toBeUndefined();
  });

  it("writes tagline (NOT bio) when a legacy client sends { bio }", async () => {
    const t = makeT();
    const userId = await signInAs(t, "auth_t2", "u_t2");

    // Legacy alias path: a pre-rename client posts `bio` — the mutation
    // must treat it as a tagline write, NOT propagate it to the bio field.
    await t.mutation(api.users.mutations.updateProfile, {
      bio: "legacy-client value",
    });

    const row = await t.run(async (ctx) => ctx.db.get(userId));
    expect(row).not.toBeNull();
    expect(row!.tagline).toBe("legacy-client value");
    // Critical invariant: the bio field is never written by this mutation.
    expect(row!.bio).toBeUndefined();
  });

  it("prefers tagline over bio when both are passed", async () => {
    const t = makeT();
    const userId = await signInAs(t, "auth_t3", "u_t3");

    await t.mutation(api.users.mutations.updateProfile, {
      bio: "legacy-bio-arg",
      tagline: "explicit-tagline-arg",
    });

    const row = await t.run(async (ctx) => ctx.db.get(userId));
    expect(row).not.toBeNull();
    expect(row!.tagline).toBe("explicit-tagline-arg");
    expect(row!.bio).toBeUndefined();
  });

  it("updates name independently of tagline/bio", async () => {
    const t = makeT();
    const userId = await signInAs(t, "auth_t4", "u_t4");

    await t.mutation(api.users.mutations.updateProfile, {
      name: "New Name",
    });

    const row = await t.run(async (ctx) => ctx.db.get(userId));
    expect(row).not.toBeNull();
    expect(row!.name).toBe("New Name");
    expect(row!.tagline).toBeUndefined();
    expect(row!.bio).toBeUndefined();
  });

  it("leaves an existing tagline intact when called with no fields", async () => {
    const t = makeT();
    const userId = await signInAs(t, "auth_t5", "u_t5");
    await t.run(async (ctx) =>
      ctx.db.patch(userId, { tagline: "preexisting" }),
    );

    await t.mutation(api.users.mutations.updateProfile, {});

    const row = await t.run(async (ctx) => ctx.db.get(userId));
    expect(row!.tagline).toBe("preexisting");
  });
});
