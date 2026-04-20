import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { TEST_EMAIL_SUFFIX, isPlaywrightTestMode } from "../auth/testMode";

function assertTestEmail(email: string): void {
  if (!email.endsWith(TEST_EMAIL_SUFFIX)) {
    throw new Error(
      `Test helpers only accept emails ending in ${TEST_EMAIL_SUFFIX}`,
    );
  }
}

/**
 * Seeds a single `waitlistRequests` row for the Playwright E2E "duplicate
 * submission shows already-on-list" scenario (FR-07). Two hard guards, both
 * required — both mirror the `auth/testHelpers.ts` pattern:
 *
 *  1. `assertTestEmail` rejects any email not ending in `@mirror.test` — a
 *     misconfigured caller cannot write a real user's email into the table.
 *  2. `isPlaywrightTestMode()` gates execution on `PLAYWRIGHT_TEST_SECRET`
 *     being set. Production Convex deployments never have this env var set
 *     (see `.claude/rules/auth.md`), so this internalMutation is effectively
 *     dead code outside of E2E and dev.
 *
 * WARNING: Never expose as a public API. `internalMutation` already makes it
 * unreachable from the browser — the belt-and-suspenders guards above exist
 * for the case where a test or dev tool accidentally passes a real email.
 */
export const seedWaitlistRow = internalMutation({
  args: {
    email: v.string(),
    submittedAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!isPlaywrightTestMode()) {
      throw new Error(
        "seedWaitlistRow requires PLAYWRIGHT_TEST_SECRET to be set",
      );
    }
    assertTestEmail(args.email);

    const normalized = args.email.trim().toLowerCase();
    const existing = await ctx.db
      .query("waitlistRequests")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .unique();
    if (existing !== null) {
      return null;
    }

    await ctx.db.insert("waitlistRequests", {
      email: normalized,
      submittedAt: args.submittedAt ?? Date.now(),
    });
    return null;
  },
});
