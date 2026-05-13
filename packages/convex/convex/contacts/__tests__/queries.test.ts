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

import { api } from "../../_generated/api";

function normalizeConvexGlob(
  raw: Record<string, () => Promise<unknown>>,
): Record<string, () => Promise<unknown>> {
  const out: Record<string, () => Promise<unknown>> = {};
  for (const [key, loader] of Object.entries(raw)) {
    let k = key;
    if (k.startsWith("./")) {
      k = "../../contacts/__tests__/" + k.slice(2);
    } else if (k.startsWith("../") && !k.startsWith("../../")) {
      k = "../../contacts/" + k.slice(3);
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

async function insertUser(
  t: ReturnType<typeof makeT>,
  username: string,
  authId = `auth_${username}`,
) {
  return t.run(async (ctx) =>
    ctx.db.insert("users", {
      authId,
      email: `${username}@example.com`,
      username,
      onboardingComplete: true,
    }),
  );
}

describe("contacts.queries.getByUsername", () => {
  it("returns null when no user matches the username", async () => {
    const t = makeT();
    const result = await t.query(api.contacts.queries.getByUsername, {
      username: "nonexistent",
    });
    expect(result).toBeNull();
  });

  it("returns empty array when user exists but has no contact entries", async () => {
    const t = makeT();
    await insertUser(t, "alice");
    const result = await t.query(api.contacts.queries.getByUsername, {
      username: "alice",
    });
    expect(result).toEqual([]);
  });

  it("sorts entries desc by _creationTime (most-recently-added first)", async () => {
    const t = makeT();
    const userId = await insertUser(t, "bob");

    await t.run(async (ctx) => {
      await ctx.db.insert("contactEntries", {
        userId,
        kind: "email",
        value: "bob@example.com",
      });
      await ctx.db.insert("contactEntries", {
        userId,
        kind: "linkedin",
        value: "https://www.linkedin.com/in/bob",
      });
      await ctx.db.insert("contactEntries", {
        userId,
        kind: "x",
        value: "https://x.com/bob",
      });
    });

    const result = await t.query(api.contacts.queries.getByUsername, {
      username: "bob",
    });
    expect(result).not.toBeNull();
    expect(result!.length).toBe(3);
    // The most-recently-inserted row (x) is first.
    expect(result!.map((e) => e.kind)).toEqual(["x", "linkedin", "email"]);
  });

  it("isolates entries by userId — two users see only their own", async () => {
    const t = makeT();
    const aliceId = await insertUser(t, "alice2");
    const bobId = await insertUser(t, "bob2");

    await t.run(async (ctx) => {
      await ctx.db.insert("contactEntries", {
        userId: aliceId,
        kind: "email",
        value: "alice@example.com",
      });
      await ctx.db.insert("contactEntries", {
        userId: bobId,
        kind: "email",
        value: "bob@example.com",
      });
    });

    const aliceResult = await t.query(api.contacts.queries.getByUsername, {
      username: "alice2",
    });
    const bobResult = await t.query(api.contacts.queries.getByUsername, {
      username: "bob2",
    });
    expect(aliceResult!.map((e) => e.value)).toEqual(["alice@example.com"]);
    expect(bobResult!.map((e) => e.value)).toEqual(["bob@example.com"]);
  });
});
