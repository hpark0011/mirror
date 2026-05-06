/// <reference types="vite/client" />

// Set required env vars BEFORE any Convex module is imported.
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

describe("users.queries.getByUsername (C1: returns BOTH bio and tagline)", () => {
  it("returns null when no user matches the username", async () => {
    const t = makeT();
    const result = await t.query(api.users.queries.getByUsername, {
      username: "nonexistent",
    });
    expect(result).toBeNull();
  });

  it("returns tagline alongside bio when both fields are set", async () => {
    const t = makeT();
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        authId: "auth_alice",
        email: "alice@example.com",
        username: "alice",
        name: "Alice",
        bio: "legacy bio text",
        tagline: "new tagline text",
        onboardingComplete: true,
      });
    });

    const result = await t.query(api.users.queries.getByUsername, {
      username: "alice",
    });
    expect(result).not.toBeNull();
    // Hard contract for C1: BOTH fields are returned so optimistic-update
    // payloads on either name continue to type-check during the cutover.
    expect(result!.bio).toBe("legacy bio text");
    expect(result!.tagline).toBe("new tagline text");
  });

  it("returns tagline as undefined when only bio is set (pre-backfill row)", async () => {
    const t = makeT();
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        authId: "auth_bob",
        email: "bob@example.com",
        username: "bob",
        bio: "only bio set",
        onboardingComplete: true,
      });
    });

    const result = await t.query(api.users.queries.getByUsername, {
      username: "bob",
    });
    expect(result).not.toBeNull();
    expect(result!.bio).toBe("only bio set");
    expect(result!.tagline).toBeUndefined();
  });

  it("returns bio as undefined when only tagline is set (post-rename row)", async () => {
    const t = makeT();
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        authId: "auth_carol",
        email: "carol@example.com",
        username: "carol",
        tagline: "only tagline set",
        onboardingComplete: true,
      });
    });

    const result = await t.query(api.users.queries.getByUsername, {
      username: "carol",
    });
    expect(result).not.toBeNull();
    expect(result!.bio).toBeUndefined();
    expect(result!.tagline).toBe("only tagline set");
  });
});

describe("users.queries.getCurrentProfile (C1: returns BOTH bio and tagline)", () => {
  it("returns null when no auth user", async () => {
    const t = makeT();
    const result = await t.query(api.users.queries.getCurrentProfile, {});
    expect(result).toBeNull();
  });
});
