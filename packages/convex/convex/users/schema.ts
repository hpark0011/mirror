import { defineTable } from "convex/server";
import { v } from "convex/values";

export const userFields = {
  authId: v.string(),
  email: v.string(),
  username: v.optional(v.string()),
  name: v.optional(v.string()),
  bio: v.optional(v.string()),
  avatarStorageId: v.optional(v.id("_storage")),
  onboardingComplete: v.boolean(),
};

export const usersTable = defineTable(userFields)
  .index("by_authId", ["authId"])
  .index("by_email", ["email"])
  .index("by_username", ["username"]);
