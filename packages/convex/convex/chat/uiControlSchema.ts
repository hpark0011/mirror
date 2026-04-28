import { defineTable } from "convex/server";
import { v } from "convex/values";
import { uiControlActionsValidator } from "./uiControlTypes";

export const uiControlActionsTable = defineTable({
  conversationId: v.id("conversations"),
  profileOwnerId: v.id("users"),
  viewerId: v.optional(v.id("users")),
  actions: uiControlActionsValidator,
  status: v.union(
    v.literal("pending"),
    v.literal("applied"),
    v.literal("rejected"),
  ),
  createdAt: v.number(),
  appliedAt: v.optional(v.number()),
}).index("by_conversationId_and_status", ["conversationId", "status"]);
