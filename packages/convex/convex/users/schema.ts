import { defineTable } from "convex/server";
import { v } from "convex/values";

export const userFields = {
  authId: v.string(),
  email: v.string(),
  username: v.optional(v.string()),
  name: v.optional(v.string()),
  // Profile-level one-line description. Distinct from the structured
  // `bioEntries` table (the Bio tab in the content panel). The clone-chat
  // system prompt injects this verbatim as the persona-voice signal; the
  // agent's `openProfileSection` tool (with section: "bio") is what
  // surfaces the bio panel for visitors.
  // See `chat/helpers.ts:composeSystemPrompt` and `.claude/rules/embeddings.md`.
  tagline: v.optional(v.string()),
  avatarStorageId: v.optional(v.id("_storage")),
  onboardingComplete: v.boolean(),
  // Deprecated deployment drift from the removed default-profile-section
  // settings experiment. Kept temporarily so Vercel can deploy the cleanup
  // mutation, then narrowed away after rows are patched.
  defaultProfileSection: v.optional(
    v.union(v.literal("bio"), v.literal("articles"), v.literal("posts")),
  ),
  personaPrompt: v.optional(v.union(v.string(), v.null())),
  tonePreset: v.optional(
    v.union(
      v.literal("professional"),
      v.literal("friendly"),
      v.literal("witty"),
      v.literal("empathetic"),
      v.literal("direct"),
      v.literal("curious"),
      v.null(),
    ),
  ),
  topicsToAvoid: v.optional(v.union(v.string(), v.null())),
  chatAuthRequired: v.optional(v.boolean()),
};

export const usersTable = defineTable(userFields)
  .index("by_authId", ["authId"])
  .index("by_email", ["email"])
  .index("by_username", ["username"]);
