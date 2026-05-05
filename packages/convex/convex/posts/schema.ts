import { defineTable } from "convex/server";
import { v } from "convex/values";
import { contentBaseFields } from "../content/schema";

export const postsTable = defineTable({
  ...contentBaseFields,
  coverImageStorageId: v.optional(v.id("_storage")),
  category: v.string(),
})
  .index("by_userId", ["userId"])
  .index("by_userId_and_slug", ["userId", "slug"])
  .index("by_userId_and_status", ["userId", "status"]);
