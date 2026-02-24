import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { authComponent } from "./auth";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

const RESERVED_USERNAMES = new Set([
  "api",
  "admin",
  "dashboard",
  "settings",
  "sign-in",
  "sign-up",
]);

const profileReturnValidator = v.object({
  _id: v.id("users"),
  authId: v.string(),
  email: v.string(),
  username: v.optional(v.string()),
  name: v.optional(v.string()),
  bio: v.optional(v.string()),
  avatarUrl: v.union(v.string(), v.null()),
  onboardingComplete: v.boolean(),
});

const publicProfileReturnValidator = v.object({
  _id: v.id("users"),
  authId: v.string(),
  username: v.optional(v.string()),
  name: v.optional(v.string()),
  bio: v.optional(v.string()),
  avatarUrl: v.union(v.string(), v.null()),
  onboardingComplete: v.boolean(),
});

async function getAppUser(
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

async function resolveAvatarUrl(
  ctx: QueryCtx | MutationCtx,
  avatarStorageId: Id<"_storage"> | undefined,
): Promise<string | null> {
  if (!avatarStorageId) {
    return null;
  }
  return await ctx.storage.getUrl(avatarStorageId);
}

export const getCurrentProfile = query({
  args: {},
  returns: v.union(profileReturnValidator, v.null()),
  handler: async (ctx) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser) {
      return null;
    }

    const appUser = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", authUser._id))
      .unique();
    if (!appUser) {
      console.warn(
        `[auth] Authenticated user has no app profile record. authId=${authUser._id} email=${authUser.email}`
      );
      return null;
    }

    const avatarUrl = await resolveAvatarUrl(ctx, appUser.avatarStorageId);

    return {
      _id: appUser._id,
      authId: appUser.authId,
      email: appUser.email,
      username: appUser.username,
      name: appUser.name,
      bio: appUser.bio,
      avatarUrl,
      onboardingComplete: appUser.onboardingComplete,
    };
  },
});

export const getByUsername = query({
  args: { username: v.string() },
  returns: v.union(publicProfileReturnValidator, v.null()),
  handler: async (ctx, args) => {
    const appUser = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", args.username))
      .unique();
    if (!appUser) {
      return null;
    }

    const avatarUrl = await resolveAvatarUrl(ctx, appUser.avatarStorageId);

    return {
      _id: appUser._id,
      authId: appUser.authId,
      username: appUser.username,
      name: appUser.name,
      bio: appUser.bio,
      avatarUrl,
      onboardingComplete: appUser.onboardingComplete,
    };
  },
});

export const isUsernameTaken = query({
  args: { username: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", args.username))
      .unique();
    return existing !== null;
  },
});

export const setUsername = mutation({
  args: { username: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const authUser = await authComponent.getAuthUser(ctx);
    if (!authUser) {
      throw new Error("Not authenticated");
    }

    const appUser = await getAppUser(ctx, authUser._id);

    const usernameRegex = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;
    if (!usernameRegex.test(args.username)) {
      throw new Error(
        "Invalid username format. Must be 3-30 characters, lowercase alphanumeric and hyphens, no leading/trailing hyphens.",
      );
    }

    if (RESERVED_USERNAMES.has(args.username)) {
      throw new Error("This username is reserved and cannot be used");
    }

    const existing = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", args.username))
      .unique();

    if (existing !== null && existing._id !== appUser._id) {
      throw new Error("Username is already taken");
    }

    await ctx.db.patch(appUser._id, { username: args.username });
    return null;
  },
});

export const updateProfile = mutation({
  args: {
    bio: v.optional(v.string()),
    name: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const authUser = await authComponent.getAuthUser(ctx);
    if (!authUser) {
      throw new Error("Not authenticated");
    }

    const appUser = await getAppUser(ctx, authUser._id);

    await ctx.db.patch(appUser._id, {
      ...(args.bio !== undefined ? { bio: args.bio } : {}),
      ...(args.name !== undefined ? { name: args.name } : {}),
    });
    return null;
  },
});

export const setAvatar = mutation({
  args: { storageId: v.id("_storage") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const authUser = await authComponent.getAuthUser(ctx);
    if (!authUser) {
      throw new Error("Not authenticated");
    }

    const appUser = await getAppUser(ctx, authUser._id);

    if (appUser.avatarStorageId) {
      await ctx.storage.delete(appUser.avatarStorageId);
    }

    await ctx.db.patch(appUser._id, { avatarStorageId: args.storageId });
    return null;
  },
});

export const completeOnboarding = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const authUser = await authComponent.getAuthUser(ctx);
    if (!authUser) {
      throw new Error("Not authenticated");
    }

    const appUser = await getAppUser(ctx, authUser._id);

    if (!appUser.username) {
      throw new Error("Username must be set before completing onboarding");
    }

    await ctx.db.patch(appUser._id, { onboardingComplete: true });
    return null;
  },
});

export const generateAvatarUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const authUser = await authComponent.getAuthUser(ctx);
    if (!authUser) {
      throw new Error("Not authenticated");
    }

    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Ensure an app user record exists for the current auth user.
 * Backfills users created before the onCreate trigger was added.
 */
export const ensureProfile = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const authUser = await authComponent.getAuthUser(ctx);
    if (!authUser) {
      throw new Error("Not authenticated");
    }

    const existing = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", authUser._id))
      .unique();

    if (!existing) {
      console.info(
        `[auth] Backfilling app profile for pre-existing auth user. authId=${authUser._id} email=${authUser.email}`
      );
      await ctx.db.insert("users", {
        authId: authUser._id,
        email: authUser.email,
        onboardingComplete: false,
      });
    }

    return null;
  },
});
