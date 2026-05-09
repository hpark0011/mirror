import { v } from "convex/values";

export const defaultProfileSectionValidator = v.union(
  v.literal("bio"),
  v.literal("posts"),
  v.literal("articles"),
);
