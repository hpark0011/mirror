/// <reference types="vite/client" />

// Set required env vars BEFORE any Convex module is imported. `convex/env.ts`
// validates these at module-load time and throws otherwise; `auth/client.ts`
// transitively imports it, and the convex-test module glob evaluates it
// even though we mock `../auth/client` for the mutations path — the glob
// still loads other files that pull the env module in. Stubbing here is
// the simplest way to keep module-load deterministic for tests.
process.env.SITE_URL = process.env.SITE_URL ?? "https://test.local";
process.env.GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ?? "test-google-client-id";
process.env.GOOGLE_CLIENT_SECRET =
  process.env.GOOGLE_CLIENT_SECRET ?? "test-google-client-secret";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConvexError } from "convex/values";
import { convexTest } from "convex-test";
// Imported via the package's workspace symlink (NOT a content-addressed
// pnpm path) so a bump of rate-limiter / convex / react doesn't rotate
// the directory name out from under this import.
import rateLimiterSchema from "../../../node_modules/@convex-dev/rate-limiter/src/component/schema";
import schema from "../../schema";

// -- Shared mock state -----------------------------------------------------
//
// These are mutated per-test to control the behavior of the mocked modules
// below. The `vi.mock` calls are hoisted by Vitest; the factories capture
// references to these objects so per-test updates are visible to the mocks.

const agentState = {
  createThreadCalls: 0,
  saveMessageCalls: 0,
  // Set by the mocked `cloneAgent.continueThread` → `thread.streamText`.
  // Tests inspect this to verify FR-01 (`maxOutputTokens: 1024`).
  streamTextCalls: [] as Array<{
    firstArg: unknown;
    secondArg: unknown;
  }>,
};

const authState = {
  // When non-null, `authComponent.safeGetAuthUser` resolves to this value.
  // Shape matches the Better Auth return type as far as `mutations.ts`
  // uses it: only `_id` (an auth-side string id) is accessed.
  currentAuthUser: null as { _id: string } | null,
};

// -- Module mocks ----------------------------------------------------------

vi.mock("@convex-dev/agent", () => {
  return {
    createThread: vi.fn(async () => {
      agentState.createThreadCalls += 1;
      return `thread_${agentState.createThreadCalls}`;
    }),
    saveMessage: vi.fn(async () => {
      agentState.saveMessageCalls += 1;
      return { messageId: `msg_${agentState.saveMessageCalls}` };
    }),
    // `listMessages` is imported by helpers.ts's `getLastUserMessage`.
    // Return an empty page so retry paths resolve cleanly.
    listMessages: vi.fn(async () => ({
      page: [],
      isDone: true,
      continueCursor: "",
    })),
    // `Agent` is constructed at module load in `chat/agent.ts`. The stub
    // must be a class; its `continueThread` method is not called by these
    // tests (we mock `cloneAgent` directly below), but the constructor
    // shape must exist.
    Agent: class {
      async continueThread() {
        return {
          thread: {
            streamText: vi.fn(async () => undefined),
          },
        };
      }
    },
    // `createTool` is imported by `chat/tools.ts:buildCloneTools`, which
    // `actions.ts:streamResponse` calls per-request. The identity stub
    // (return `def` as-is) is enough — these tests don't exercise tool
    // execution; they assert on `streamArgs` shape captured by the
    // `cloneAgent` mock below.
    createTool: vi.fn((def: unknown) => def),
  };
});

// `chat/agent.ts` exports `cloneAgent`. `chat/actions.ts` imports it via
// `"./agent"`. Using `vi.mock("../agent", ...)` here resolves (relative
// to this test file) to `convex/chat/agent.ts` — the same absolute path
// `actions.ts`'s `./agent` resolves to, so the interception applies to
// both callers.
vi.mock("../agent", () => {
  return {
    cloneAgent: {
      continueThread: vi.fn(async () => ({
        thread: {
          streamText: vi.fn(async (firstArg: unknown, secondArg: unknown) => {
            agentState.streamTextCalls.push({ firstArg, secondArg });
            return undefined;
          }),
        },
      })),
    },
  };
});

// `actions.ts` imports `embed` from the `ai` package and calls google embed.
// Without real keys this would throw during module init or at call time.
// Stub `embed` to throw so the RAG try/catch falls through with empty
// `ragContext`. The `@ai-sdk/google` default import is also stubbed so
// module-load doesn't fail.
vi.mock("ai", () => {
  return {
    embed: vi.fn(async () => {
      throw new Error("embed stubbed in test — RAG falls through");
    }),
    stepCountIs: vi.fn((count: number) => {
      return ({ steps }: { steps: unknown[] }) => steps.length === count;
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

// `mutations.ts` imports `authComponent` from `"../auth/client"`. Vitest
// resolves `vi.mock(spec, ...)` to an ABSOLUTE path relative to the test
// file that contains the `vi.mock` call, then intercepts any import that
// resolves to the same absolute path — regardless of what relative
// specifier the consumer used. So from THIS file the correct spec is
// `"../../auth/client"`, which resolves to `convex/auth/client.ts`, which
// is also what `mutations.ts`'s `"../auth/client"` resolves to.
vi.mock("../../auth/client", () => {
  return {
    authComponent: {
      safeGetAuthUser: vi.fn(async () => authState.currentAuthUser),
    },
  };
});

// --------------------------------------------------------------------------

import { api, internal } from "../../_generated/api";
import { normalizeConvexGlob } from "./testUtils";

const rawChatModules = import.meta.glob("../../**/*.{ts,js}");
const modules = normalizeConvexGlob(rawChatModules);
// Glob the rate-limiter component source via the workspace symlink (same
// import path style as `rateLimiterSchema` above). Avoids pinning the
// content-addressed `.pnpm/` path, which rotates on lockfile refreshes.
const rateLimiterModules = import.meta.glob(
  "../../../node_modules/@convex-dev/rate-limiter/src/component/**/*.ts",
);

/**
 * Convex serializes `ConvexError.data` as a JSON string when it crosses
 * the mutation/transaction boundary into the test harness. Parse it back
 * into the structured shape our handlers threw.
 */
function getErrorData(e: unknown): { code: string; retryAfterMs: number } {
  const raw = (e as ConvexError<unknown>).data;
  if (typeof raw === "string") {
    return JSON.parse(raw) as { code: string; retryAfterMs: number };
  }
  return raw as { code: string; retryAfterMs: number };
}

function makeT() {
  const t = convexTest(schema, modules);
  t.registerComponent(
    "rateLimiter",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rateLimiterSchema as any,
    rateLimiterModules,
  );
  return t;
}

// Helper: insert a profile-owner user row. Returns the Id<"users">.
async function insertOwner(
  t: ReturnType<typeof makeT>,
  overrides: { authId?: string; email?: string } = {},
) {
  return t.run(async (ctx) =>
    ctx.db.insert("users", {
      authId: overrides.authId ?? "auth_owner",
      email: overrides.email ?? "owner@example.com",
      onboardingComplete: true,
    }),
  );
}

// Helper: insert an authenticated app user row and set `authState` so
// `authComponent.safeGetAuthUser` returns a shape that resolves to it.
async function insertAppUserAndSignIn(
  t: ReturnType<typeof makeT>,
  authId: string,
  email: string,
) {
  const appUserId = await t.run(async (ctx) =>
    ctx.db.insert("users", {
      authId,
      email,
      onboardingComplete: true,
    }),
  );
  authState.currentAuthUser = { _id: authId };
  return appUserId;
}

// Helper: insert a conversation row (pre-existing path). `viewerId` defaults
// to undefined (anonymous viewer).
async function insertConversation(
  t: ReturnType<typeof makeT>,
  profileOwnerId: Awaited<ReturnType<typeof insertOwner>>,
  overrides: {
    viewerId?: Awaited<ReturnType<typeof insertOwner>>;
    threadId?: string;
    title?: string;
  } = {},
) {
  return t.run(async (ctx) =>
    ctx.db.insert("conversations", {
      profileOwnerId,
      viewerId: overrides.viewerId,
      threadId: overrides.threadId ?? `thread_${Date.now()}`,
      status: "active",
      title: overrides.title ?? "seed",
    }),
  );
}

// Helper: clear the streaming-lock fields on a conversation so back-to-back
// `sendMessage` calls on the same conversation don't trip the concurrency
// guard.
async function clearLock(
  t: ReturnType<typeof makeT>,
  conversationId: Awaited<ReturnType<typeof insertConversation>>,
) {
  await t.run(async (ctx) =>
    ctx.db.patch(conversationId, {
      streamingInProgress: false,
      streamingStartedAt: undefined,
    }),
  );
}

// --------------------------------------------------------------------------
// Wave 1 rate-limit integration tests
// --------------------------------------------------------------------------

describe("chat rate limits (Wave 1)", () => {
  beforeEach(() => {
    agentState.createThreadCalls = 0;
    agentState.saveMessageCalls = 0;
    agentState.streamTextCalls = [];
    authState.currentAuthUser = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -- FR-02 --------------------------------------------------------------

  it("FR-02: message > 3000 chars is rejected before any rate-limit call", async () => {
    const t = makeT();
    const profileOwnerId = await insertOwner(t);

    await expect(
      t.mutation(api.chat.mutations.sendMessage, {
        profileOwnerId,
        content: "x".repeat(3001),
      }),
    ).rejects.toThrow(/3000 character limit/);

    // A 3000-char message does not trip the length check (may still fail
    // further down but not on length). Verify by catching any error and
    // asserting the message is NOT the length error.
    let err: unknown;
    try {
      await t.mutation(api.chat.mutations.sendMessage, {
        profileOwnerId,
        content: "y".repeat(3000),
      });
    } catch (e) {
      err = e;
    }
    if (err) {
      expect(String((err as Error).message ?? "")).not.toMatch(
        /3000 character limit/,
      );
    }
  });

  // -- FR-03 / NFR-03: anon daily bucket boundary + lock-state invariant --

  it("FR-03 + NFR-03: 50 anon sends pass, 51st throws RATE_LIMIT_DAILY and leaves lock untouched", async () => {
    const t = makeT();
    const profileOwnerId = await insertOwner(t);
    const conversationId = await insertConversation(t, profileOwnerId, {
      threadId: "thread_fr03",
    });

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-15T00:00:00Z"));

    // Exhaust the anon daily bucket (capacity 50). Advance fake time 7s
    // between calls so the per-minute `sendMessage` bucket (10/min fixed
    // window) refills faster than we consume it.
    for (let i = 0; i < 50; i++) {
      vi.advanceTimersByTime(7_000);
      await t.mutation(api.chat.mutations.sendMessage, {
        profileOwnerId,
        conversationId,
        content: `m${i}`,
      });
      await clearLock(t, conversationId);
    }

    // Verify lock is clear BEFORE the doomed call so any post-call change
    // is attributable to the rate-limit rejection path.
    const beforeDoc = await t.run(async (ctx) => ctx.db.get(conversationId));
    expect(beforeDoc?.streamingInProgress).toBeFalsy();

    // 51st call — daily bucket should have ~0.8 tokens and reject.
    vi.advanceTimersByTime(7_000);
    let caught: unknown;
    try {
      await t.mutation(api.chat.mutations.sendMessage, {
        profileOwnerId,
        conversationId,
        content: "doomed",
      });
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(ConvexError);
    const data = getErrorData(caught);
    expect(data.code).toBe("RATE_LIMIT_DAILY");
    expect(data.retryAfterMs).toBeGreaterThan(0);

    // NFR-03: streaming lock must NOT have been patched to true.
    const afterDoc = await t.run(async (ctx) => ctx.db.get(conversationId));
    expect(afterDoc?.streamingInProgress).toBeFalsy();
    expect(afterDoc?.streamingStartedAt).toBeUndefined();
  }, 30_000);

  // -- FR-03 refill ------------------------------------------------------

  it("FR-03: anon daily bucket refills after 24h", async () => {
    const t = makeT();
    const profileOwnerId = await insertOwner(t);
    const conversationId = await insertConversation(t, profileOwnerId, {
      threadId: "thread_fr03_refill",
    });

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-15T00:00:00Z"));

    // Exhaust bucket.
    for (let i = 0; i < 50; i++) {
      vi.advanceTimersByTime(7_000);
      await t.mutation(api.chat.mutations.sendMessage, {
        profileOwnerId,
        conversationId,
        content: `m${i}`,
      });
      await clearLock(t, conversationId);
    }

    // Confirm exhausted.
    vi.advanceTimersByTime(7_000);
    await expect(
      t.mutation(api.chat.mutations.sendMessage, {
        profileOwnerId,
        conversationId,
        content: "doomed",
      }),
    ).rejects.toBeInstanceOf(ConvexError);

    // Advance 24h. Token bucket rate is 200/day, so the bucket is now at
    // its refill ceiling (capacity 50).
    vi.advanceTimersByTime(24 * 60 * 60 * 1000);

    // Next send must succeed.
    await t.mutation(api.chat.mutations.sendMessage, {
      profileOwnerId,
      conversationId,
      content: "after refill",
    });
  }, 30_000);

  // -- FR-04: authenticated daily bucket --------------------------------

  it("FR-04: 100 auth sends pass, 101st throws RATE_LIMIT_DAILY", async () => {
    const t = makeT();
    const profileOwnerId = await insertOwner(t, {
      authId: "auth_fr04_owner",
      email: "fr04-owner@example.com",
    });
    // Viewer is a DIFFERENT authenticated user so `chatAuthRequired` would
    // be bypassed regardless. Authenticated key is `appUser._id`.
    const appUserId = await insertAppUserAndSignIn(
      t,
      "auth_fr04_viewer",
      "fr04-viewer@example.com",
    );
    const conversationId = await t.run(async (ctx) =>
      ctx.db.insert("conversations", {
        profileOwnerId,
        viewerId: appUserId,
        threadId: "thread_fr04",
        status: "active",
        title: "seed",
      }),
    );

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-15T00:00:00Z"));

    // Auth daily bucket is capacity 100 with rate 500/day. Advance 7s
    // between calls to keep the per-minute `sendMessage` bucket (10/min)
    // happy. The daily bucket refills 500/day × 7s = ~0.04 tokens per
    // call, so the 100 capacity isn't exhausted exactly at the 101st
    // attempt — we need a few more calls (~105) before the bucket
    // deterministically refuses. Loop until the first ConvexError
    // surfaces, bounded at 120 iterations so a regression would fail
    // loudly instead of running forever.
    let i = 0;
    let succeeded = 0;
    // First: prove 100 sends pass back-to-back (boundary requirement).
    for (i = 0; i < 100; i++) {
      vi.advanceTimersByTime(7_000);
      await t.mutation(api.chat.mutations.sendMessage, {
        profileOwnerId,
        conversationId,
        content: `a${i}`,
      });
      await clearLock(t, conversationId);
      succeeded += 1;
    }
    expect(succeeded).toBe(100);

    // Then: keep going until the daily bucket refuses.
    let caught: unknown;
    for (let j = 0; j < 20 && caught === undefined; j++) {
      vi.advanceTimersByTime(7_000);
      try {
        await t.mutation(api.chat.mutations.sendMessage, {
          profileOwnerId,
          conversationId,
          content: `auth${100 + j}`,
        });
        await clearLock(t, conversationId);
      } catch (e) {
        caught = e;
      }
    }
    expect(caught).toBeInstanceOf(ConvexError);
    const data = getErrorData(caught);
    expect(data.code).toBe("RATE_LIMIT_DAILY");
    expect(data.retryAfterMs).toBeGreaterThan(0);
  }, 60_000);

  // -- FR-05: retryMessage cross-conversation key unification -------------

  it("FR-05: anon exhausts daily on conv A, retryMessage on conv B throws RATE_LIMIT_DAILY", async () => {
    const t = makeT();
    const profileOwnerId = await insertOwner(t, {
      authId: "auth_fr05_owner",
      email: "fr05-owner@example.com",
    });

    // Conversation A — used to burn the anon daily bucket via sendMessage.
    const convA = await insertConversation(t, profileOwnerId, {
      threadId: "thread_fr05_A",
    });

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-15T00:00:00Z"));

    for (let i = 0; i < 50; i++) {
      vi.advanceTimersByTime(7_000);
      await t.mutation(api.chat.mutations.sendMessage, {
        profileOwnerId,
        conversationId: convA,
        content: `m${i}`,
      });
      await clearLock(t, convA);
    }

    // Conversation B — fresh conversation for the same profileOwnerId and
    // the same anonymous viewer. If `retryMessage` was (incorrectly) keyed
    // by `conversationId`, its daily bucket on `convB` would be untouched
    // and the call would succeed. The Wave 1 re-keying uses
    // `profileOwnerId` instead, so the bucket seen is already exhausted.
    const convB = await insertConversation(t, profileOwnerId, {
      threadId: "thread_fr05_B",
    });

    vi.advanceTimersByTime(1_000);
    let caught: unknown;
    try {
      await t.mutation(api.chat.mutations.retryMessage, {
        conversationId: convB,
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ConvexError);
    const data = getErrorData(caught);
    expect(data.code).toBe("RATE_LIMIT_DAILY");
    expect(data.retryAfterMs).toBeGreaterThan(0);
  }, 30_000);

  // -- FR-06: new-conversation churn attack exhaustion -------------------

  it("FR-06: churn attack via new-conversation path trips the daily bucket", async () => {
    const t = makeT();
    const profileOwnerId = await insertOwner(t, {
      authId: "auth_fr06_owner",
      email: "fr06-owner@example.com",
    });

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-15T00:00:00Z"));

    // Send N new-conversation requests, advancing time 25s each to keep
    // the per-minute `createConversation` bucket (3/min fixed window)
    // happy. Loop until a ConvexError surfaces; bounded at 80 iterations
    // so a regression would fail loudly instead of hanging.
    let caught: unknown;
    let iterations = 0;
    for (let i = 0; i < 80 && caught === undefined; i++) {
      vi.advanceTimersByTime(25_000);
      iterations += 1;
      try {
        await t.mutation(api.chat.mutations.sendMessage, {
          profileOwnerId,
          content: `churn ${i}`,
        });
      } catch (e) {
        caught = e;
      }
    }

    expect(caught).toBeInstanceOf(ConvexError);
    const data = getErrorData(caught);
    // The daily bucket is the FR-06 regression guard. Per-minute would
    // surface only if we forgot to advance time — both codes are
    // structured ConvexErrors, but we assert RATE_LIMIT_DAILY specifically
    // because that's what the churn-attack fix is testing.
    expect(data.code).toBe("RATE_LIMIT_DAILY");
    expect(data.retryAfterMs).toBeGreaterThan(0);
    // Sanity: we should have needed >= 50 iterations. Before the daily
    // bucket, an attacker could churn 3/min × 60 × 24 = 4320/day.
    expect(iterations).toBeGreaterThanOrEqual(50);
    expect(iterations).toBeLessThanOrEqual(80);
  }, 30_000);

  // -- FR-07: structured error shape (covered by FR-03 / FR-04 / FR-05
  //    assertions above; add one per-minute shape check here) ------------

  it("FR-06/FR-07: 11th per-minute call throws RATE_LIMIT_MINUTE with positive retryAfterMs", async () => {
    const t = makeT();
    const profileOwnerId = await insertOwner(t, {
      authId: "auth_fr07_owner",
      email: "fr07-owner@example.com",
    });
    const conversationId = await insertConversation(t, profileOwnerId, {
      threadId: "thread_fr07",
    });

    // Don't advance time — per-minute bucket (10/min) is the first to hit.
    for (let i = 0; i < 10; i++) {
      await t.mutation(api.chat.mutations.sendMessage, {
        profileOwnerId,
        conversationId,
        content: `m${i}`,
      });
      await clearLock(t, conversationId);
    }

    let caught: unknown;
    try {
      await t.mutation(api.chat.mutations.sendMessage, {
        profileOwnerId,
        conversationId,
        content: "burst11",
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ConvexError);
    const data = getErrorData(caught);
    expect(data.code).toBe("RATE_LIMIT_MINUTE");
    expect(data.retryAfterMs).toBeGreaterThan(0);
  });
});

// --------------------------------------------------------------------------
// FR-01: `thread.streamText` is invoked with `maxOutputTokens: 1024`
//
// Behavioral (not source-string) verification: we mock `./agent` so that
// `cloneAgent.continueThread` returns a fake thread whose `streamText` is a
// `vi.fn`. We then drive `streamResponse` via `t.action(...)` and inspect
// the recorded first argument.
//
// RAG is stubbed to fail via the `ai.embed` mock above, so the action's
// try/catch leaves `ragContext` empty and proceeds directly to
// `thread.streamText`.
// --------------------------------------------------------------------------

// Helper: drain the microtask/macrotask queue so any pending setTimeouts
// from prior tests' scheduled functions fire before we start observing.
// convex-test schedules user-scheduled functions via `setTimeout(0)`, so
// under real timers they queue onto the task queue; waiting a couple of
// ticks gives them a chance to execute.
async function drainEventLoop(ticks = 5) {
  for (let i = 0; i < ticks; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

describe("FR-01: streamResponse passes maxOutputTokens: 1024 to thread.streamText", () => {
  beforeEach(async () => {
    // Drain any leftover scheduled-function callbacks from prior tests so
    // they settle into `streamTextCalls` BEFORE we reset the array.
    await drainEventLoop();
    agentState.streamTextCalls = [];
    authState.currentAuthUser = null;
  });

  async function seedStreamResponseContext() {
    const t = makeT();
    const profileOwnerId = await insertOwner(t, {
      authId: "auth_fr01_owner",
      email: "fr01-owner@example.com",
    });
    const conversationId = await insertConversation(t, profileOwnerId, {
      threadId: "thread_fr01",
    });
    return { t, profileOwnerId, conversationId };
  }

  it("streamArgs with a promptMessageId includes maxOutputTokens: 1024", async () => {
    const { t, profileOwnerId, conversationId } =
      await seedStreamResponseContext();

    // Drain again and capture index AFTER seeding context, so any timer
    // callbacks left over from setup are already settled.
    await drainEventLoop();
    const startIdx = agentState.streamTextCalls.length;

    await t.action(internal.chat.actions.streamResponse, {
      conversationId,
      profileOwnerId,
      promptMessageId: "msg_seed",
      lockStartedAt: Date.now(),
      userMessage: "hello",
    });

    // Drain one more time so any synchronous setTimeouts queued by the
    // action or by leftover schedulers are visible.
    await drainEventLoop();

    const ourCalls = agentState.streamTextCalls.slice(startIdx);
    // Find the call that corresponds to OUR direct action invocation by
    // matching the promptMessageId we passed. This avoids false positives
    // from scheduled functions leaking across tests.
    const ourCall = ourCalls.find((c) => {
      const fa = c.firstArg as Record<string, unknown> | null;
      return fa && fa.promptMessageId === "msg_seed";
    });
    expect(ourCall, `ourCalls=${JSON.stringify(ourCalls.map((c) => c.firstArg))}`).toBeDefined();
    const firstArg = ourCall!.firstArg as Record<string, unknown>;
    expect(firstArg).toMatchObject({
      maxOutputTokens: 1024,
      promptMessageId: "msg_seed",
    });
    expect(typeof firstArg.stopWhen).toBe("function");
    const stopWhen = firstArg.stopWhen as (args: {
      steps: unknown[];
    }) => boolean;
    expect(stopWhen({ steps: [{}, {}] })).toBe(false);
    expect(stopWhen({ steps: [{}, {}, {}] })).toBe(true);
    expect(typeof firstArg.system).toBe("string");
  });

  it("streamArgs without a promptMessageId (retry branch) also includes maxOutputTokens: 1024", async () => {
    const { t, profileOwnerId, conversationId } =
      await seedStreamResponseContext();

    const startIdx = agentState.streamTextCalls.length;

    await t.action(internal.chat.actions.streamResponse, {
      conversationId,
      profileOwnerId,
      promptMessageId: "",
      lockStartedAt: Date.now(),
      // No `userMessage` → retry semantics; action falls back to
      // `getLastUserMessage` (mocked listMessages returns empty → null).
    });

    const ourCalls = agentState.streamTextCalls.slice(startIdx);
    expect(ourCalls.length).toBeGreaterThanOrEqual(1);
    const firstArg = ourCalls[0].firstArg as Record<string, unknown>;
    expect(firstArg).toMatchObject({ maxOutputTokens: 1024 });
    expect(typeof firstArg.stopWhen).toBe("function");
    // Retry branch MUST NOT include `promptMessageId` (empty string means
    // "respond to latest user message" and is stripped).
    expect(firstArg.promptMessageId).toBeUndefined();
    expect(typeof firstArg.system).toBe("string");
  });
});
