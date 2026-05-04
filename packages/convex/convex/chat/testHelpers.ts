import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { chatRateLimiter } from "./rateLimits";

/**
 * Test-only helper: drains the anonymous daily chat bucket for the profile
 * owner with the given username so a Playwright E2E can observe the
 * daily-cap error path without sending 50+ real messages.
 *
 * Registered as `internalMutation` — unreachable from the browser. Invoked
 * from the Next API route at `/api/test/exhaust-chat-daily`, which itself is
 * gated by `PLAYWRIGHT_TEST_SECRET`.
 */
export const exhaustAnonDailyBucket = internalMutation({
  args: {
    username: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { username }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", username))
      .unique();
    if (!user) {
      throw new Error(`User not found: ${username}`);
    }
    await chatRateLimiter.reset(ctx, "sendMessageDailyAnon", {
      key: user._id,
    });
    await chatRateLimiter.limit(ctx, "sendMessageDailyAnon", {
      key: user._id,
      count: 50,
      throws: false,
    });
    return null;
  },
});

/**
 * Test-only helper: refills the anonymous daily chat bucket for the profile
 * owner with the given username. Counterpart to `exhaustAnonDailyBucket` — used
 * to recover after a rate-limit-spec run so other chat e2e specs don't hit a
 * drained bucket.
 *
 * Registered as `internalMutation` — unreachable from the browser. Callable
 * via `convex run chat/testHelpers:resetAnonDailyBucket '{"username":"..."}'`.
 */
export const resetAnonDailyBucket = internalMutation({
  args: {
    username: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { username }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", username))
      .unique();
    if (!user) {
      throw new Error(`User not found: ${username}`);
    }
    await chatRateLimiter.reset(ctx, "sendMessageDailyAnon", {
      key: user._id,
    });
    return null;
  },
});
