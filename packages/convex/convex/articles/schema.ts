import { defineTable } from "convex/server";
import { v } from "convex/values";

export const articleStatusValidator = v.union(
  v.literal("draft"),
  v.literal("published"),
);

export const articleFields = {
  userId: v.id("users"),
  slug: v.string(),
  title: v.string(),
  coverImageStorageId: v.optional(v.id("_storage")),
  createdAt: v.number(),
  publishedAt: v.optional(v.number()),
  status: articleStatusValidator,
  category: v.string(),
  body: v.any(),
};

export const articlesTable = defineTable(articleFields)
  .index("by_userId", ["userId"])
  .index("by_userId_and_slug", ["userId", "slug"]);
