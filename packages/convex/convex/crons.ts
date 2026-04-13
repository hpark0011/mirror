import { cronJobs } from "convex/server";
import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

const STALE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

export const clearStaleStreamingLocks = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const cutoff = Date.now() - STALE_THRESHOLD_MS;

    const staleConversations = await ctx.db
      .query("conversations")
      .withIndex(
        "by_streamingInProgress_and_streamingStartedAt",
        (q) => q.eq("streamingInProgress", true).lt("streamingStartedAt", cutoff),
      )
      .collect();
    for (const conversation of staleConversations) {
      await ctx.db.patch(conversation._id, {
        streamingInProgress: false,
        streamingStartedAt: undefined,
      });
    }

    return null;
  },
});

const crons = cronJobs();

crons.interval(
  "clear stale streaming locks",
  { minutes: 5 },
  internal.crons.clearStaleStreamingLocks,
  {},
);

crons.interval(
  "cleanup stale test otps",
  { minutes: 15 },
  internal.auth.testHelpers.cleanupStaleTestOtps,
  {},
);

export default crons;
