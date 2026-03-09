import { defineTable } from "convex/server";
import { v } from "convex/values";
import { contentBaseFields, contentStatusValidator } from "../content/schema";

export const articleStatusValidator = contentStatusValidator;

export const articleFields = {
  ...contentBaseFields,
  coverImageStorageId: v.optional(v.id("_storage")),
  category: v.string(),
};

export const articlesTable = defineTable(articleFields)
  .index("by_userId", ["userId"])
  .index("by_userId_and_slug", ["userId", "slug"]);
