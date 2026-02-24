import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    authId: v.string(),
    email: v.string(),
    username: v.optional(v.string()),
    name: v.optional(v.string()),
    bio: v.optional(v.string()),
    avatarStorageId: v.optional(v.id("_storage")),
    onboardingComplete: v.boolean(),
  })
    .index("by_authId", ["authId"])
    .index("by_email", ["email"])
    .index("by_username", ["username"]),
});
