import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

export const backfillConversationMode = internalMutation({
  args: {
    dryRun: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    scanned: v.number(),
    patched: v.number(),
    dryRun: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? true;
    const limit = args.limit ?? 100;
    let scanned = 0;
    let patched = 0;

    for await (const conversation of ctx.db.query("conversations")) {
      if (scanned >= limit) break;
      scanned += 1;
      if (conversation.mode !== undefined) continue;
      patched += 1;
      if (!dryRun) {
        await ctx.db.patch(conversation._id, { mode: "clone" });
      }
    }

    return { scanned, patched, dryRun };
  },
});
