import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import {
  ensureRickRubinUser,
  ensureRickRubinArticles,
  ensureRickRubinPosts,
  ensureRickRubinConversations,
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

// Dev-only: clones Rick's article/post/conversation fixtures under an
// already-existing `users` row. Idempotent. Slugs are unique-per-user
// (see `articles/schema.ts:by_userId_and_slug`), so reusing Rick's slugs
// under another userId is safe.
//
// Called from two places:
//   - `seedWorktreeOwnerDemo` (manual / by-email lookup)
//   - `auth/client.ts user.onCreate` trigger (auto, on first sign-in,
//      gated by env.DEV_AUTOSEED_OWNER on dev deployments)
export const seedOwnerContent = internalMutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ensureRickRubinArticles(ctx, args.userId);
    await ensureRickRubinPosts(ctx, args.userId);
    await ensureRickRubinConversations(ctx, args.userId);
    return null;
  },
});

// Dev-only: clones Rick's fixtures under the worktree owner's existing
// `users` row so `/@<your-username>` is pre-populated for in-app browsing.
// Caller must have signed in with Google first (the auth `user.onCreate`
// flow is what provisions the `users` row this seed targets — the seed
// deliberately does NOT create it).
export const seedWorktreeOwnerDemo = internalMutation({
  args: { email: v.string() },
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
    await ensureRickRubinArticles(ctx, owner._id);
    await ensureRickRubinPosts(ctx, owner._id);
    await ensureRickRubinConversations(ctx, owner._id);
    return owner._id;
  },
});
