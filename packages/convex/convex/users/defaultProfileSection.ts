import { v } from "convex/values";

// Keep in sync with DEFAULT_PROFILE_SECTION_VALUES in
// packages/convex/convex/content/href.ts.
export const defaultProfileSectionValidator = v.union(
  v.literal("bio"),
  v.literal("posts"),
  v.literal("articles"),
);
