import { v } from "convex/values";
import { type QueryCtx, type MutationCtx } from "../_generated/server";
import { type Id } from "../_generated/dataModel";

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
} as const;

export const profileReturnValidator = v.object(profileReturnFields);

export const currentProfileReturnValidator = v.object(profileReturnFields);

export const publicProfileReturnValidator = v.object({
  _id: v.id("users"),
  authId: v.string(),
  username: v.optional(v.string()),
  name: v.optional(v.string()),
  tagline: v.optional(v.string()),
  avatarUrl: v.union(v.string(), v.null()),
  onboardingComplete: v.boolean(),
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
