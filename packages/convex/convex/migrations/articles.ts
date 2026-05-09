import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

export const backfillCoverImageOwnershipKind = internalMutation({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    isDone: v.boolean(),
    continueCursor: v.string(),
    patched: v.number(),
  }),
  handler: async (ctx, { paginationOpts }) => {
    const page = await ctx.db
      .query("coverImageOwnership")
      .paginate(paginationOpts);
    let patched = 0;

    for (const row of page.page) {
      if (row.kind !== undefined) continue;
      await ctx.db.patch(row._id, { kind: "image" });
      patched += 1;
    }

    return {
      isDone: page.isDone,
      continueCursor: page.continueCursor,
      patched,
    };
  },
});
