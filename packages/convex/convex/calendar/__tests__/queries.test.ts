/// <reference types="vite/client" />

// Env setup runs before any Convex module-level import via the global
// vitest setupFiles (`convex/__tests__/envSetup.ts`).

import { beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../schema";
import { REQUIRED_CALENDAR_SCOPES } from "../tokens";

// Shared mock state. Driven by the test before invoking `t.query(...)`.
const authState = {
  currentAuthUser: null as { _id: string } | null,
};
const tokensState = {
  // Default: not connected. Tests override per-case.
  status: { kind: "not_connected" } as Awaited<
    ReturnType<
      typeof import("../tokens").readOwnerCalendarConnectionStatus
    >
  >,
};

// The convex-test module glob loads every file under `convex/`, including
// modules that init at import time (the agent runtime, the AI SDK, the
// google embedding model). Stub them the same way the bio/posts tests do.
vi.mock("@convex-dev/agent", () => ({
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
}));

vi.mock("ai", () => ({
  embed: vi.fn(async () => {
    throw new Error("embed stubbed");
  }),
  embedMany: vi.fn(async () => ({ embeddings: [] })),
}));

vi.mock("@ai-sdk/google", () => ({
  google: {
    textEmbeddingModel: vi.fn(() => ({})),
  },
}));

vi.mock("../../auth/client", () => ({
  authComponent: {
    safeGetAuthUser: vi.fn(async () => authState.currentAuthUser),
    getAuthUser: vi.fn(async () => {
      if (!authState.currentAuthUser) {
        throw new Error("Not authenticated");
      }
      return authState.currentAuthUser;
    }),
  },
}));

// Mock the tokens module so the query test can drive each connection-status
// branch without registering the `@convex-dev/better-auth` component in
// convex-test. The actual token-resolution behavior is covered by
// `tokens.test.ts` against a fake-ctx — there's no value in re-asserting it
// through the query layer.
vi.mock("../tokens", async () => {
  const real = await vi.importActual<typeof import("../tokens")>("../tokens");
  return {
    ...real,
    readOwnerCalendarConnectionStatus: vi.fn(async () => tokensState.status),
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
      k = "../../calendar/__tests__/" + k.slice(2);
    } else if (k.startsWith("../") && !k.startsWith("../../")) {
      k = "../../calendar/" + k.slice(3);
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

async function signInAs(t: ReturnType<typeof makeT>, authId: string) {
  const userId = await t.run(async (ctx) =>
    ctx.db.insert("users", {
      authId,
      email: `${authId}@example.com`,
      username: `u_${authId.slice(-6)}`,
      onboardingComplete: true,
    }),
  );
  authState.currentAuthUser = { _id: authId };
  return userId;
}

describe("calendar.queries.queryConnectionStatus", () => {
  beforeEach(() => {
    authState.currentAuthUser = null;
    tokensState.status = { kind: "not_connected" };
  });

  it("rejects when not authenticated", async () => {
    const t = makeT();
    await expect(
      t.query(api.calendar.queries.queryConnectionStatus, {}),
    ).rejects.toThrow();
  });

  it("disconnected: no Google account, no preferences", async () => {
    const t = makeT();
    await signInAs(t, "auth_owner_dc");
    tokensState.status = { kind: "not_connected" };
    const result = await t.query(
      api.calendar.queries.queryConnectionStatus,
      {},
    );
    expect(result.state).toBe("disconnected");
    expect(result.presentScopes).toEqual([]);
    expect(result.missingScopes).toEqual([]);
    expect(result.preferences).toBeNull();
  });

  it("needs_reconnect: Google account present but Calendar scopes missing", async () => {
    const t = makeT();
    await signInAs(t, "auth_owner_nr");
    tokensState.status = {
      kind: "missing_scopes",
      presentScopes: ["openid", "email"],
      missingScopes: [...REQUIRED_CALENDAR_SCOPES],
    };
    const result = await t.query(
      api.calendar.queries.queryConnectionStatus,
      {},
    );
    expect(result.state).toBe("needs_reconnect");
    expect(result.presentScopes).toEqual(["openid", "email"]);
    expect(result.missingScopes).toEqual([...REQUIRED_CALENDAR_SCOPES]);
    expect(result.preferences).toBeNull();
  });

  it("ready: Calendar scopes present, no saved preferences yet", async () => {
    const t = makeT();
    await signInAs(t, "auth_owner_rdy");
    tokensState.status = {
      kind: "ready",
      presentScopes: [...REQUIRED_CALENDAR_SCOPES],
      refreshTokenPresent: true,
      expiresAtMs: Date.now() + 60_000,
    };
    const result = await t.query(
      api.calendar.queries.queryConnectionStatus,
      {},
    );
    expect(result.state).toBe("ready");
    expect(result.presentScopes).toEqual([...REQUIRED_CALENDAR_SCOPES]);
    expect(result.preferences).toBeNull();
  });

  it("ready with preferences: surfaces every saved field", async () => {
    const t = makeT();
    const ownerId = await signInAs(t, "auth_owner_p");
    tokensState.status = {
      kind: "ready",
      presentScopes: [...REQUIRED_CALENDAR_SCOPES],
      refreshTokenPresent: true,
    };
    await t.run(async (ctx) =>
      ctx.db.insert("calendarConnections", {
        userId: ownerId,
        provider: "google",
        enabled: true,
        calendarId: "primary",
        timeZone: "America/Los_Angeles",
        defaultDurationMinutes: 30,
        minLeadTimeMinutes: 60,
        maxDaysAhead: 30,
        bufferMinutes: 15,
        createGoogleMeet: true,
        updatedAt: 1_700_000_000_000,
      }),
    );
    const result = await t.query(
      api.calendar.queries.queryConnectionStatus,
      {},
    );
    expect(result.state).toBe("ready");
    expect(result.preferences).toEqual({
      enabled: true,
      calendarId: "primary",
      timeZone: "America/Los_Angeles",
      defaultDurationMinutes: 30,
      minLeadTimeMinutes: 60,
      maxDaysAhead: 30,
      bufferMinutes: 15,
      createGoogleMeet: true,
    });
  });

  it("isolation: a different user's preferences row is ignored", async () => {
    const t = makeT();
    // Owner A signs in
    const ownerAId = await signInAs(t, "auth_owner_a");
    tokensState.status = {
      kind: "ready",
      presentScopes: [...REQUIRED_CALENDAR_SCOPES],
      refreshTokenPresent: true,
    };
    // Seed a connection row owned by a DIFFERENT user (B)
    await t.run(async (ctx) => {
      const ownerBId = await ctx.db.insert("users", {
        authId: "auth_owner_b",
        email: "b@example.com",
        username: "ub",
        onboardingComplete: true,
      });
      await ctx.db.insert("calendarConnections", {
        userId: ownerBId,
        provider: "google",
        enabled: true,
        calendarId: "primary",
        timeZone: "Europe/London",
        defaultDurationMinutes: 60,
        minLeadTimeMinutes: 60,
        maxDaysAhead: 14,
        bufferMinutes: 0,
        createGoogleMeet: false,
        updatedAt: 1_700_000_000_000,
      });
    });
    // A's query must NOT see B's row.
    const result = await t.query(
      api.calendar.queries.queryConnectionStatus,
      {},
    );
    expect(result.preferences).toBeNull();
    void ownerAId; // satisfy linter — exists only to assert isolation
  });
});
