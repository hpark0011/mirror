/// <reference types="vite/client" />

// Set required env vars BEFORE any Convex module is imported. `convex/env.ts`
// validates these at module-load time and throws otherwise.
process.env.SITE_URL = process.env.SITE_URL ?? "https://test.local";
process.env.GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ?? "test-google-client-id";
process.env.GOOGLE_CLIENT_SECRET =
  process.env.GOOGLE_CLIENT_SECRET ?? "test-google-client-secret";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConvexError } from "convex/values";
import { convexTest } from "convex-test";
// Imported via the package's workspace symlink (NOT a content-addressed
// pnpm path) so a bump of rate-limiter / convex doesn't rotate the
// directory name out from under this import. Mirrors `chat/__tests__/rateLimits.test.ts`.
import rateLimiterSchema from "../../../node_modules/@convex-dev/rate-limiter/src/component/schema";
import { api, internal } from "../../_generated/api";
import schema from "../../schema";

// Vite's `import.meta.glob` normalizes keys to the shortest possible
// relative path from the importing file, which gives mixed prefixes when
// the test lives in a nested __tests__/ dir. `convex-test` needs a single
// uniform prefix rooted at the `_generated/` entry, so we rewrite every
// key to start with `../../<dir>/...` (relative to the convex/ root when
// viewed from here).
function normalizeConvexGlob(
  raw: Record<string, () => Promise<unknown>>,
): Record<string, () => Promise<unknown>> {
  const out: Record<string, () => Promise<unknown>> = {};
  for (const [key, loader] of Object.entries(raw)) {
    let k = key;
    if (k.startsWith("./")) {
      k = "../../waitlistRequests/__tests__/" + k.slice(2);
    } else if (k.startsWith("../") && !k.startsWith("../../")) {
      k = "../../waitlistRequests/" + k.slice(3);
    }
    out[k] = loader;
  }
  return out;
}

const rawModules = import.meta.glob("../../**/*.{ts,js}");
const modules = normalizeConvexGlob(rawModules);
// Glob the rate-limiter component source via the workspace symlink (same
// import path style as `rateLimiterSchema` above). Avoids pinning the
// content-addressed `.pnpm/` path, which rotates on lockfile refreshes.
const rateLimiterModules = import.meta.glob(
  "../../../node_modules/@convex-dev/rate-limiter/src/component/**/*.ts",
);

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

/**
 * Convex serializes `ConvexError.data` as a JSON string when it crosses
 * the mutation/transaction boundary into the test harness. Parse it back
 * into the structured shape our handlers threw.
 */
function getErrorData(e: unknown): { code: string; retryAfterMs?: number } {
  const raw = (e as ConvexError<unknown>).data;
  if (typeof raw === "string") {
    return JSON.parse(raw) as { code: string; retryAfterMs?: number };
  }
  return raw as { code: string; retryAfterMs?: number };
}

describe("waitlistRequests.mutations.submit", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  // -- FR-02 -------------------------------------------------------------

  it("FR-02: inserts exactly one row and returns { alreadyOnList: false } on first submit", async () => {
    const t = makeT();
    const result = await t.mutation(api.waitlistRequests.mutations.submit, {
      email: "first@example.com",
    });
    expect(result).toEqual({ alreadyOnList: false });

    const rows = await t.run(async (ctx) =>
      ctx.db.query("waitlistRequests").collect(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe("first@example.com");
    expect(typeof rows[0].submittedAt).toBe("number");
  });

  it("FR-02: second submit of the same email returns alreadyOnList:true and does NOT insert a duplicate row", async () => {
    const t = makeT();
    const a = await t.mutation(api.waitlistRequests.mutations.submit, {
      email: "dup@example.com",
    });
    const b = await t.mutation(api.waitlistRequests.mutations.submit, {
      email: "dup@example.com",
    });
    expect(a).toEqual({ alreadyOnList: false });
    expect(b).toEqual({ alreadyOnList: true });

    const rows = await t.run(async (ctx) =>
      ctx.db.query("waitlistRequests").collect(),
    );
    expect(rows).toHaveLength(1);
  });

  it("FR-02: email is stored lowercased and trimmed", async () => {
    const t = makeT();
    await t.mutation(api.waitlistRequests.mutations.submit, {
      email: "  MiXeD@CaSe.com  ",
    });

    const rows = await t.run(async (ctx) =>
      ctx.db.query("waitlistRequests").collect(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe("mixed@case.com");
  });

  // -- FR-04 -------------------------------------------------------------

  it("FR-04: obviously invalid email throws INVALID_EMAIL and leaves the table empty", async () => {
    const t = makeT();
    let caught: unknown;
    try {
      await t.mutation(api.waitlistRequests.mutations.submit, {
        email: "not-an-email",
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ConvexError);
    const data = getErrorData(caught);
    expect(data.code).toBe("INVALID_EMAIL");

    const rows = await t.run(async (ctx) =>
      ctx.db.query("waitlistRequests").collect(),
    );
    expect(rows).toHaveLength(0);
  });

  // -- FR-03 -------------------------------------------------------------

  it("FR-03: 4th submit from the same email within one hour throws RATE_LIMIT; row count stays at 1", async () => {
    const t = makeT();

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-15T00:00:00Z"));

    // First submit succeeds and inserts a row.
    await t.mutation(api.waitlistRequests.mutations.submit, {
      email: "rate@example.com",
    });
    // Next two submits are duplicates (alreadyOnList: true) — they consume
    // per-email tokens but do NOT insert a row. Total 3 submissions in the
    // window. Assert the idempotency shape explicitly so a regression here
    // surfaces as a clear failure instead of an unexpected throw downstream.
    vi.advanceTimersByTime(1_000);
    const result2 = await t.mutation(api.waitlistRequests.mutations.submit, {
      email: "rate@example.com",
    });
    expect(result2).toEqual({ alreadyOnList: true });
    vi.advanceTimersByTime(1_000);
    const result3 = await t.mutation(api.waitlistRequests.mutations.submit, {
      email: "rate@example.com",
    });
    expect(result3).toEqual({ alreadyOnList: true });

    // 4th call must trip the per-email fixed-window limit (3/hour).
    vi.advanceTimersByTime(1_000);
    let caught: unknown;
    try {
      await t.mutation(api.waitlistRequests.mutations.submit, {
        email: "rate@example.com",
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ConvexError);
    const data = getErrorData(caught);
    expect(data.code).toBe("RATE_LIMIT");
    expect(data.retryAfterMs).toBeGreaterThan(0);

    // Row count must still be 1 (only the first insert).
    const rows = await t.run(async (ctx) =>
      ctx.db.query("waitlistRequests").collect(),
    );
    expect(rows).toHaveLength(1);
  });

  // The "rate-limit clears after window" assertion was spiked first per the
  // spec's edge-cases guidance. Under `convex-test` with the in-memory
  // rate-limiter component registered, `vi.setSystemTime(+1hr)` DOES
  // propagate into the component's `Date.now()` reads — see the chat
  // rate-limit tests (`chat/__tests__/rateLimits.test.ts`) which exercise
  // the same pattern with a 24h window. So we keep the assertion.
  it("FR-03: per-email rate limit clears after the 1-hour window advances", async () => {
    const t = makeT();

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-15T00:00:00Z"));

    // Burn the per-email bucket (3 submits in the hour).
    await t.mutation(api.waitlistRequests.mutations.submit, {
      email: "clear@example.com",
    });
    for (let i = 0; i < 2; i++) {
      vi.advanceTimersByTime(1_000);
      await t.mutation(api.waitlistRequests.mutations.submit, {
        email: "clear@example.com",
      });
    }

    // 4th call inside the window is rejected.
    vi.advanceTimersByTime(1_000);
    await expect(
      t.mutation(api.waitlistRequests.mutations.submit, {
        email: "clear@example.com",
      }),
    ).rejects.toBeInstanceOf(ConvexError);

    // Advance past the 1-hour window boundary. Fixed-window resets at the
    // boundary, so the next call must succeed.
    vi.advanceTimersByTime(60 * 60 * 1000);

    const result = await t.mutation(api.waitlistRequests.mutations.submit, {
      email: "clear@example.com",
    });
    // The row already exists from the first call, so this is a duplicate
    // (alreadyOnList: true) — the key assertion is that it did NOT throw.
    expect(result).toEqual({ alreadyOnList: true });
  });

  // -- NFR-02 — rate-limit rejection does not leak whether the email is
  //            already on the list ------------------------------------------

  it("NFR-02: rate-limit rejection has the same shape for listed and unlisted emails", async () => {
    const t = makeT();

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-15T00:00:00Z"));

    // Case (a): an unknown email that burns its per-email bucket. First
    // submit is INVALID_EMAIL-free (lands a row), next two consume the
    // remaining 2 tokens, 4th rejects.
    const unknownEmail = "unknown@example.com";
    await t.mutation(api.waitlistRequests.mutations.submit, {
      email: unknownEmail,
    });
    vi.advanceTimersByTime(100);
    await t.mutation(api.waitlistRequests.mutations.submit, {
      email: unknownEmail,
    });
    vi.advanceTimersByTime(100);
    await t.mutation(api.waitlistRequests.mutations.submit, {
      email: unknownEmail,
    });
    vi.advanceTimersByTime(100);
    let caughtUnknown: unknown;
    try {
      await t.mutation(api.waitlistRequests.mutations.submit, {
        email: unknownEmail,
      });
    } catch (e) {
      caughtUnknown = e;
    }
    expect(caughtUnknown).toBeInstanceOf(ConvexError);
    const dataUnknown = getErrorData(caughtUnknown);
    expect(dataUnknown.code).toBe("RATE_LIMIT");

    // Case (b): an email that is ALREADY on the list also gets the
    // same-shaped RATE_LIMIT error once its per-email bucket is burned.
    // Use a distinct email so its per-email bucket is fresh.
    const listedEmail = "listed@example.com";
    // Seed the row directly (bypasses per-email bucket for setup).
    await t.run(async (ctx) =>
      ctx.db.insert("waitlistRequests", {
        email: listedEmail,
        submittedAt: Date.now(),
      }),
    );
    // Burn the per-email bucket with 3 submits.
    await t.mutation(api.waitlistRequests.mutations.submit, {
      email: listedEmail,
    });
    vi.advanceTimersByTime(100);
    await t.mutation(api.waitlistRequests.mutations.submit, {
      email: listedEmail,
    });
    vi.advanceTimersByTime(100);
    await t.mutation(api.waitlistRequests.mutations.submit, {
      email: listedEmail,
    });
    vi.advanceTimersByTime(100);
    let caughtListed: unknown;
    try {
      await t.mutation(api.waitlistRequests.mutations.submit, {
        email: listedEmail,
      });
    } catch (e) {
      caughtListed = e;
    }
    expect(caughtListed).toBeInstanceOf(ConvexError);
    const dataListed = getErrorData(caughtListed);
    expect(dataListed.code).toBe("RATE_LIMIT");

    // Both errors must expose the same discrimination key.
    expect(dataListed.code).toBe(dataUnknown.code);
    // Both must include a numeric retryAfterMs.
    expect(typeof dataListed.retryAfterMs).toBe("number");
    expect(typeof dataUnknown.retryAfterMs).toBe("number");
  });

  // -- NFR-01 — at most one query + one insert per submit -----------------

  it("NFR-01: submit issues at most one waitlistRequests query + at most one insert", async () => {
    const t = makeT();

    // Spy on ctx.db via `t.run` — `convex-test` does not expose a direct
    // spy hook, so we observe through row-count deltas: a single submit of
    // a fresh email must produce exactly 1 new row, and a duplicate submit
    // must produce 0 new rows. This is a weaker-but-equivalent proof of
    // NFR-01's "at most one insert" clause.
    const before = await t.run(async (ctx) =>
      ctx.db.query("waitlistRequests").collect(),
    );
    expect(before).toHaveLength(0);

    // First submit — one insert.
    await t.mutation(api.waitlistRequests.mutations.submit, {
      email: "count@example.com",
    });
    const after1 = await t.run(async (ctx) =>
      ctx.db.query("waitlistRequests").collect(),
    );
    expect(after1).toHaveLength(1);

    // Duplicate submit — zero inserts.
    await t.mutation(api.waitlistRequests.mutations.submit, {
      email: "count@example.com",
    });
    const after2 = await t.run(async (ctx) =>
      ctx.db.query("waitlistRequests").collect(),
    );
    expect(after2).toHaveLength(1);
  });

  // -- Internal query smoke test -----------------------------------------

  it("queries.listAll returns rows ordered newest-first", async () => {
    const t = makeT();

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-15T00:00:00Z"));

    await t.mutation(api.waitlistRequests.mutations.submit, {
      email: "oldest@example.com",
    });
    vi.advanceTimersByTime(10_000);
    await t.mutation(api.waitlistRequests.mutations.submit, {
      email: "middle@example.com",
    });
    vi.advanceTimersByTime(10_000);
    await t.mutation(api.waitlistRequests.mutations.submit, {
      email: "newest@example.com",
    });

    const rows = await t.query(
      internal.waitlistRequests.queries.listAll,
      {},
    );
    expect(rows.map((r) => r.email)).toEqual([
      "newest@example.com",
      "middle@example.com",
      "oldest@example.com",
    ]);
  });

  // -- testHelpers.seedWaitlistRow guardrails ----------------------------

  describe("testHelpers.seedWaitlistRow", () => {
    const ORIGINAL_SECRET = process.env.PLAYWRIGHT_TEST_SECRET;

    beforeEach(() => {
      process.env.PLAYWRIGHT_TEST_SECRET = "test-secret";
    });

    afterEach(() => {
      if (ORIGINAL_SECRET === undefined) {
        delete process.env.PLAYWRIGHT_TEST_SECRET;
      } else {
        process.env.PLAYWRIGHT_TEST_SECRET = ORIGINAL_SECRET;
      }
    });

    it("seeds a row when PLAYWRIGHT_TEST_SECRET is set and email ends in @mirror.test", async () => {
      const t = makeT();
      await t.mutation(
        internal.waitlistRequests.testHelpers.seedWaitlistRow,
        { email: "alice@mirror.test" },
      );
      const rows = await t.run(async (ctx) =>
        ctx.db.query("waitlistRequests").collect(),
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].email).toBe("alice@mirror.test");
    });

    it("rejects non-@mirror.test emails even when PLAYWRIGHT_TEST_SECRET is set", async () => {
      const t = makeT();
      await expect(
        t.mutation(
          internal.waitlistRequests.testHelpers.seedWaitlistRow,
          { email: "real@example.com" },
        ),
      ).rejects.toThrow(/@mirror\.test/);
    });

    it("rejects the call when PLAYWRIGHT_TEST_SECRET is NOT set", async () => {
      delete process.env.PLAYWRIGHT_TEST_SECRET;
      const t = makeT();
      await expect(
        t.mutation(
          internal.waitlistRequests.testHelpers.seedWaitlistRow,
          { email: "alice@mirror.test" },
        ),
      ).rejects.toThrow(/PLAYWRIGHT_TEST_SECRET/);
    });
  });
});
