/// <reference types="vite/client" />

// Set required env vars BEFORE any Convex module is imported. `convex/env.ts`
// validates these at module-load time and throws otherwise. Same pattern as
// `chat/__tests__/rateLimits.test.ts`.
process.env.SITE_URL = process.env.SITE_URL ?? "https://test.local";
process.env.GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ?? "test-google-client-id";
process.env.GOOGLE_CLIENT_SECRET =
  process.env.GOOGLE_CLIENT_SECRET ?? "test-google-client-secret";

import { describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../schema";

// Mocks: same shapes as the chat tests. The bio queries don't pull in the
// agent or rate-limiter, but the convex-test module glob loads every file
// under convex/ — we still need to stub the modules that init at load
// (`@convex-dev/agent` / `ai` / `@ai-sdk/google`).
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

// Vite's `import.meta.glob` from a nested `__tests__/` dir returns mixed
// relative prefixes; convex-test infers a single root from `_generated/`,
// so we rewrite keys to start with `../../bio/...` (the bio dir relative
// to convex/ as seen from this test file's location).
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

describe("bio.queries.getByUsername (FR-09, FR-10)", () => {
  it("returns null when no user matches the username", async () => {
    const t = makeT();
    const result = await t.query(api.bio.queries.getByUsername, {
      username: "nonexistent",
    });
    expect(result).toBeNull();
  });

  it("returns empty array when user exists but has no bio entries", async () => {
    const t = makeT();
    await insertUser(t, "alice");
    const result = await t.query(api.bio.queries.getByUsername, {
      username: "alice",
    });
    expect(result).toEqual([]);
  });

  it("FR-09: sorts entries desc by startDate, ties broken by _creationTime desc", async () => {
    const t = makeT();
    const userId = await insertUser(t, "bob");

    // Insert in scrambled order. Entries [a] and [c] tie on startDate so the
    // ties must break by _creationTime desc (later-inserted wins).
    await t.run(async (ctx) => {
      // a: Jan 2022, inserted first
      await ctx.db.insert("bioEntries", {
        userId,
        kind: "work",
        title: "a",
        startDate: utcMonth(2022, 1),
        endDate: utcMonth(2022, 12),
      });
      // b: 2024 (newest startDate)
      await ctx.db.insert("bioEntries", {
        userId,
        kind: "work",
        title: "b",
        startDate: utcMonth(2024, 1),
        endDate: null,
      });
      // c: Jan 2022 (ties with a), inserted later
      await ctx.db.insert("bioEntries", {
        userId,
        kind: "education",
        title: "c",
        startDate: utcMonth(2022, 1),
        endDate: utcMonth(2023, 6),
      });
      // d: 2018
      await ctx.db.insert("bioEntries", {
        userId,
        kind: "education",
        title: "d",
        startDate: utcMonth(2018, 9),
        endDate: utcMonth(2022, 5),
      });
    });

    const result = await t.query(api.bio.queries.getByUsername, {
      username: "bob",
    });
    expect(result).not.toBeNull();
    const titles = result!.map((e) => e.title);
    // newest-first: b (2024) → c (2022, later _creationTime) → a (2022, earlier _creationTime) → d (2018)
    expect(titles).toEqual(["b", "c", "a", "d"]);
  });

  it("FR-10: returns at most 50 entries when 60 exist; oldest 10 are excluded", async () => {
    const t = makeT();
    const userId = await insertUser(t, "carol");

    await t.run(async (ctx) => {
      for (let i = 0; i < 60; i++) {
        // startDate: month i+1 of 2020 (capped at 12) — distinct, increasing
        // by year so ordering is deterministic. Use January of years
        // 2020..2079 so all 60 startDates are unique.
        await ctx.db.insert("bioEntries", {
          userId,
          kind: "work",
          title: `entry-${i}`,
          startDate: utcMonth(2020 + i, 1),
          endDate: null,
        });
      }
    });

    const result = await t.query(api.bio.queries.getByUsername, {
      username: "carol",
    });
    expect(result).not.toBeNull();
    expect(result!.length).toBe(50);
    // Newest first: 2020+59 = 2079, down to 2020+10 = 2030 (50 entries).
    // The oldest 10 (years 2020..2029) MUST be excluded.
    const titles = result!.map((e) => e.title);
    expect(titles[0]).toBe("entry-59");
    expect(titles[49]).toBe("entry-10");
    // Sanity — entries 0..9 are not present.
    for (let i = 0; i < 10; i++) {
      expect(titles).not.toContain(`entry-${i}`);
    }
  });

  it("isolates entries by userId — two users see only their own", async () => {
    const t = makeT();
    const aliceId = await insertUser(t, "alice2");
    const bobId = await insertUser(t, "bob2");

    await t.run(async (ctx) => {
      await ctx.db.insert("bioEntries", {
        userId: aliceId,
        kind: "work",
        title: "alice-only",
        startDate: utcMonth(2020, 1),
        endDate: null,
      });
      await ctx.db.insert("bioEntries", {
        userId: bobId,
        kind: "education",
        title: "bob-only",
        startDate: utcMonth(2020, 1),
        endDate: null,
      });
    });

    const aliceResult = await t.query(api.bio.queries.getByUsername, {
      username: "alice2",
    });
    const bobResult = await t.query(api.bio.queries.getByUsername, {
      username: "bob2",
    });
    expect(aliceResult!.map((e) => e.title)).toEqual(["alice-only"]);
    expect(bobResult!.map((e) => e.title)).toEqual(["bob-only"]);
  });
});
