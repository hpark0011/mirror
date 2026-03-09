import { v } from "convex/values";

export const contentStatusValidator = v.union(
  v.literal("draft"),
  v.literal("published"),
);

export const contentBaseFields = {
  userId: v.id("users"),
  slug: v.string(),
  title: v.string(),
  body: v.any(),
  createdAt: v.number(),
  publishedAt: v.optional(v.number()),
  status: contentStatusValidator,
};

export const MAX_TITLE_LENGTH = 500;
export const MAX_SLUG_LENGTH = 200;
