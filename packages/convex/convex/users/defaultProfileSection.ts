import { v } from "convex/values";

// Release A migration-envelope validator. Delete with the legacy schema field
// after cleanup is verified on every deployment.
export const defaultProfileSectionValidator = v.union(
  v.literal("bio"),
  v.literal("contact"),
  v.literal("projects"),
  v.literal("posts"),
  v.literal("articles"),
);
