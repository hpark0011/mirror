import { defineTable } from "convex/server";
import { v } from "convex/values";

export const conversationsTable = defineTable({
  profileOwnerId: v.id("users"),
  viewerId: v.optional(v.id("users")),
  threadId: v.string(),
  status: v.union(v.literal("active"), v.literal("archived")),
  title: v.string(),
  streamingInProgress: v.optional(v.boolean()),
  streamingStartedAt: v.optional(v.number()),
  // Activity tracking fields (deployed via other branch, kept for compatibility)
  lastActivityAt: v.optional(v.number()),
  lastActivitySortKey: v.optional(v.string()),
  lastMessagePreview: v.optional(v.string()),
  lastMessageRole: v.optional(v.string()),
})
  .index("by_profileOwnerId_and_viewerId", ["profileOwnerId", "viewerId"])
  .index("by_viewerId", ["viewerId"])
  .index("by_threadId", ["threadId"])
  .index("by_streamingInProgress_and_streamingStartedAt", [
    "streamingInProgress",
    "streamingStartedAt",
  ]);
