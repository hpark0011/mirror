/// <reference types="vite/client" />

// Env setup BEFORE any Convex module is imported. `convex/env.ts` validates
// these at module-load time and throws otherwise; `auth/client.ts`
// transitively imports it, and the convex-test module glob evaluates it.
process.env.SITE_URL = process.env.SITE_URL ?? "https://test.local";
process.env.GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ?? "test-google-client-id";
process.env.GOOGLE_CLIENT_SECRET =
  process.env.GOOGLE_CLIENT_SECRET ?? "test-google-client-secret";

import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import { internal } from "../../_generated/api";
import schema from "../../schema";

// Vite's `import.meta.glob` normalizes keys to the shortest possible
// relative path from the importing file. convex-test needs a single uniform
// prefix rooted at the `_generated/` entry, so rewrite every key to start
// with `../../<dir>/...` (the convex/ root when viewed from here).
function normalizeConvexGlob(
  raw: Record<string, () => Promise<unknown>>,
): Record<string, () => Promise<unknown>> {
  const out: Record<string, () => Promise<unknown>> = {};
  for (const [key, loader] of Object.entries(raw)) {
    let k = key;
    if (k.startsWith("./")) {
      k = "../../auth/__tests__/" + k.slice(2);
    } else if (k.startsWith("../") && !k.startsWith("../../")) {
      k = "../../auth/" + k.slice(3);
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

describe("resetTestUser (FG_249 regression — duplicate users rows)", () => {
  it("returns null without throwing when no row exists for the email", async () => {
    const t = makeT();

    await expect(
      t.mutation(internal.auth.testHelpers.resetTestUser, {
        email: "nobody@mirror.test",
      }),
    ).resolves.toBeNull();
  });

  it("resets the single row for a test email", async () => {
    const t = makeT();
    const email = "solo@mirror.test";

    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        authId: `real_${email}`,
        email,
        username: "solodude",
        onboardingComplete: true,
      });
    });

    await t.mutation(internal.auth.testHelpers.resetTestUser, { email });

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", email))
        .collect(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].username).toBeUndefined();
    expect(rows[0].onboardingComplete).toBe(false);
  });

  it("does not throw when two rows share one @mirror.test email and resets the primary (non-synthetic) row", async () => {
    const t = makeT();
    const email = "dupuser@mirror.test";
    const syntheticAuthId = `test_${email}`;

    await t.run(async (ctx) => {
      // Synthetic row — created by ensureTestUser's auth shim.
      await ctx.db.insert("users", {
        authId: syntheticAuthId,
        email,
        username: "dupuser-synthetic",
        onboardingComplete: true,
      });
      // Real Better Auth row — the one that should be reset.
      await ctx.db.insert("users", {
        authId: `real_${email}`,
        email,
        username: "dupuser-real",
        onboardingComplete: true,
      });
    });

    // Must NOT throw (was throwing with .unique() when two rows exist).
    await expect(
      t.mutation(internal.auth.testHelpers.resetTestUser, { email }),
    ).resolves.toBeNull();

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", email))
        .collect(),
    );

    // The primary (non-synthetic) row must be reset.
    const primaryRow = rows.find((r) => r.authId !== syntheticAuthId);
    expect(primaryRow).toBeDefined();
    expect(primaryRow!.username).toBeUndefined();
    expect(primaryRow!.onboardingComplete).toBe(false);
  });
});
