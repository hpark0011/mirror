import { defineTable } from "convex/server";
import { v } from "convex/values";
import { contentBaseFields } from "../content/schema";

export const postsTable = defineTable({
  ...contentBaseFields,
  coverImageStorageId: v.optional(v.id("_storage")),
  coverImageThumbhash: v.optional(v.string()),
  // Mirrors articles' video cover surface. Image and video are mutually
  // exclusive at the mutation boundary; keeping each as separate optionals
  // means no migration is required on existing rows. Render precedence:
  // video wins when `coverVideoStorageId` is set, otherwise the image cover
  // (or none).
  coverVideoStorageId: v.optional(v.id("_storage")),
  coverVideoPosterStorageId: v.optional(v.id("_storage")),
  category: v.string(),
})
  .index("by_userId", ["userId"])
  .index("by_userId_and_slug", ["userId", "slug"])
  .index("by_userId_and_status", ["userId", "status"])
  .index("by_userId_status_publishedAt", ["userId", "status", "publishedAt"]);
