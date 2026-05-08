import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import {
  ensureRickRubinUser,
  ensureRickRubinArticles,
  ensureRickRubinPosts,
  ensureRickRubinConversations,
  ensureWorktreeOwnerProfile,
  ensureWorktreeOwnerBio,
} from "./seed/helpers";

export const seedRickRubin = internalMutation({
  args: {},
  returns: v.id("users"),
  handler: async (ctx) => {
    return await ensureRickRubinUser(ctx);
  },
});

export const seedRickRubinArticles = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const userId = await ensureRickRubinUser(ctx);
    await ensureRickRubinArticles(ctx, userId);
    return null;
  },
});

export const seedRickRubinPosts = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const userId = await ensureRickRubinUser(ctx);
    await ensureRickRubinPosts(ctx, userId);
    return null;
  },
});

export const seedRickRubinConversations = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const userId = await ensureRickRubinUser(ctx);
    await ensureRickRubinConversations(ctx, userId);
    return null;
  },
});

export const seedRickRubinDemo = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const userId = await ensureRickRubinUser(ctx);
    await ensureRickRubinArticles(ctx, userId);
    await ensureRickRubinPosts(ctx, userId);
    await ensureRickRubinConversations(ctx, userId);
    return null;
  },
});

// Dev-only: clones Rick's article/post/conversation/bio fixtures under an
// already-existing `users` row AND patches profile fields (username/name/
// tagline/onboardingComplete) so `/onboarding` redirects straight to
// `/@<username>`. Idempotent — per-field guards never overwrite values
// the owner has already set.
//
// Called from two places:
//   - `seedWorktreeOwnerDemo` (manual / by-email lookup)
//   - `auth/client.ts user.onCreate` trigger (auto, on first sign-in,
//      gated by env.DEV_AUTOSEED_OWNER on dev deployments)
export const seedOwnerContent = internalMutation({
  args: {
    userId: v.id("users"),
    email: v.string(),
    name: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ensureWorktreeOwnerProfile(ctx, args.userId, args.email, args.name);
    await ensureWorktreeOwnerBio(ctx, args.userId);
    await ensureRickRubinArticles(ctx, args.userId);
    await ensureRickRubinPosts(ctx, args.userId);
    await ensureRickRubinConversations(ctx, args.userId);
    return null;
  },
});

// Dev-only: clones Rick's article/post/conversation/bio fixtures under the
// worktree owner's existing `users` row so `/@<your-username>` is
// pre-populated for in-app browsing AND patches the user row with
// onboarding-equivalent fields (username/name/tagline/onboardingComplete)
// so /onboarding redirects straight to the profile. Caller must have
// signed in with Google first (the auth `user.onCreate` flow is what
// provisions the `users` row this seed targets — the seed deliberately
// does NOT create it). Slugs are unique-per-user (see
// `articles/schema.ts:by_userId_and_slug`), so reusing Rick's slugs
// under another userId is safe. Idempotent — never overwrites profile
// fields the owner has already set.
export const seedWorktreeOwnerDemo = internalMutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const target = args.email.toLowerCase();
    // Dev users tables are tiny (worktree owner + Rick + maybe a few
    // test fixtures). A collect-and-filter avoids assuming Better Auth
    // stores the email in a specific case (see `auth/client.ts:84` —
    // it persists `doc.email` verbatim).
    const allUsers = await ctx.db.query("users").collect();
    const owner = allUsers.find((u) => u.email.toLowerCase() === target);
    if (!owner) {
      throw new Error(
        `seedWorktreeOwnerDemo: no \`users\` row for ${args.email}. Sign in with Google at the worktree's app URL first to provision your account, then re-run this mutation.`,
      );
    }
    await ensureWorktreeOwnerProfile(ctx, owner._id, owner.email, args.name);
    await ensureWorktreeOwnerBio(ctx, owner._id);
    await ensureRickRubinArticles(ctx, owner._id);
    await ensureRickRubinPosts(ctx, owner._id);
    await ensureRickRubinConversations(ctx, owner._id);
    return owner._id;
  },
});
