import { internalQuery } from "../_generated/server";
import { v } from "convex/values";

export const readTestCoverBlobStorageState = internalQuery({
  args: {
    storageId: v.id("_storage"),
  },
  returns: v.object({
    storageExists: v.boolean(),
    ownershipExists: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const storage = await ctx.db.system.get(args.storageId);
    const ownership = await ctx.db
      .query("coverImageOwnership")
      .withIndex("by_storageId", (q) => q.eq("storageId", args.storageId))
      .unique();

    return {
      storageExists: storage !== null,
      ownershipExists: ownership !== null,
    };
  },
});
