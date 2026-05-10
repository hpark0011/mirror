import { v } from "convex/values";
import { type QueryCtx, type MutationCtx } from "../_generated/server";
import { type Id } from "../_generated/dataModel";
import { tonePresetValidator, type TonePreset } from "../chat/tonePresets";
import { defaultProfileSectionValidator } from "./defaultProfileSection";

export const RESERVED_USERNAMES = new Set([
  "api",
  "admin",
  "dashboard",
  "settings",
  "sign-in",
  "sign-up",
]);

const profileReturnFields = {
  _id: v.id("users"),
  authId: v.string(),
  email: v.string(),
  username: v.optional(v.string()),
  name: v.optional(v.string()),
  tagline: v.optional(v.string()),
  avatarUrl: v.union(v.string(), v.null()),
  onboardingComplete: v.boolean(),
  defaultProfileSection: defaultProfileSectionValidator,
} as const;

export const profileReturnValidator = v.object(profileReturnFields);

/**
 * Return validator for getCurrentProfile — composes the shared profile fields
 * with the owner-only persona fields.
 */
export const currentProfileReturnValidator = v.object({
  ...profileReturnFields,
  personaPrompt: v.optional(v.union(v.string(), v.null())),
  tonePreset: v.optional(v.union(tonePresetValidator, v.null())),
  topicsToAvoid: v.optional(v.union(v.string(), v.null())),
});

export const publicProfileReturnValidator = v.object({
  _id: v.id("users"),
  authId: v.string(),
  username: v.optional(v.string()),
  name: v.optional(v.string()),
  tagline: v.optional(v.string()),
  avatarUrl: v.union(v.string(), v.null()),
  onboardingComplete: v.boolean(),
  defaultProfileSection: defaultProfileSectionValidator,
  chatAuthRequired: v.optional(v.boolean()),
});

export async function getAppUser(
  ctx: QueryCtx | MutationCtx,
  authId: Id<"users"> | string,
) {
  const appUser = await ctx.db
    .query("users")
    .withIndex("by_authId", (q) => q.eq("authId", authId as string))
    .unique();
  if (!appUser) {
    throw new Error("App user not found");
  }
  return appUser;
}

export async function resolveAvatarUrl(
  ctx: QueryCtx | MutationCtx,
  avatarStorageId: Id<"_storage"> | undefined,
): Promise<string | null> {
  if (!avatarStorageId) {
    return null;
  }
  return await ctx.storage.getUrl(avatarStorageId);
}

export interface PersonaSettingsArgs {
  personaPrompt?: string | null;
  tonePreset?: TonePreset | null;
  topicsToAvoid?: string | null;
}

export function buildPersonaPatch(
  args: PersonaSettingsArgs,
): Record<string, unknown> {
  // Length guards — checked BEFORE any DB write.
  if (
    typeof args.personaPrompt === "string" &&
    args.personaPrompt.length > 4000
  ) {
    throw new Error("personaPrompt exceeds 4000 characters");
  }
  if (
    typeof args.topicsToAvoid === "string" &&
    args.topicsToAvoid.length > 500
  ) {
    throw new Error("topicsToAvoid exceeds 500 characters");
  }

  const patch: Record<string, unknown> = {};
  if (args.personaPrompt !== undefined)
    patch.personaPrompt = args.personaPrompt;
  if (args.tonePreset !== undefined) patch.tonePreset = args.tonePreset;
  if (args.topicsToAvoid !== undefined)
    patch.topicsToAvoid = args.topicsToAvoid;
  return patch;
}
