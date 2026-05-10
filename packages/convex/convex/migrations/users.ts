import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

export const deleteDefaultProfileSection = internalMutation({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
    patched: v.number(),
  }),
  handler: async (ctx, { paginationOpts }) => {
    const page = await ctx.db.query("users").paginate(paginationOpts);
    let patched = 0;

    for (const user of page.page) {
      if (user.defaultProfileSection === undefined) continue;
      await ctx.db.patch(user._id, { defaultProfileSection: undefined });
      patched += 1;
    }

    return {
      isDone: page.isDone,
      continueCursor: page.continueCursor,
      patched,
    };
  },
});
