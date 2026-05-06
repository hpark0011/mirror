import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * One-shot backfill: copy every user's `bio` value into `tagline`. Idempotent —
 * if `tagline` is already set, leave it alone and don't overwrite from `bio`.
 * Run once after C1 deploys; safe to re-run.
 *
 * Removed (or left as a no-op) in C2 once `bio` is dropped from the schema.
 */
export const backfillTaglineFromBio = internalMutation({
  args: {},
  returns: v.object({ updated: v.number(), skipped: v.number() }),
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    let updated = 0;
    let skipped = 0;
    for (const u of users) {
      if (u.tagline !== undefined && u.tagline !== null && u.tagline !== "") {
        skipped++;
        continue;
      }
      if (u.bio === undefined || u.bio === null || u.bio === "") {
        skipped++;
        continue;
      }
      await ctx.db.patch(u._id, { tagline: u.bio });
      updated++;
    }
    return { updated, skipped };
  },
});
