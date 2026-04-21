import { v } from "convex/values";
import { internalQuery } from "../_generated/server";

/**
 * Admin surface for viewing all waitlist submissions, ordered newest-first.
 * Registered as `internalQuery` — not exposed to the browser — and intended
 * to be invoked from the CLI, e.g.:
 *
 *   npx convex run waitlistRequests/queries:listAll '{}'
 */
export const listAll = internalQuery({
  args: {},
  // Keep in sync with waitlistRequestsTable in schema.ts — add any new fields here or listAll will fail runtime validation.
  returns: v.array(
    v.object({
      _id: v.id("waitlistRequests"),
      _creationTime: v.number(),
      email: v.string(),
      submittedAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    return await ctx.db.query("waitlistRequests").order("desc").collect();
  },
});
