import { query } from "../_generated/server";
import { v } from "convex/values";
import { authComponent } from "../auth/client";
import {
  currentProfileReturnValidator,
  publicProfileReturnValidator,
  resolveAvatarUrl,
} from "./helpers";

export const getCurrentProfile = query({
  args: {},
  returns: v.union(currentProfileReturnValidator, v.null()),
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
      tagline: appUser.tagline,
      avatarUrl,
      onboardingComplete: appUser.onboardingComplete,
      personaPrompt: appUser.personaPrompt,
      tonePreset: appUser.tonePreset,
      topicsToAvoid: appUser.topicsToAvoid,
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
      tagline: appUser.tagline,
      avatarUrl,
      onboardingComplete: appUser.onboardingComplete,
      chatAuthRequired: appUser.chatAuthRequired,
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
