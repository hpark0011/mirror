// Public mutations + queries for the inline-image lifecycle on posts.
//
// Read-side trust boundary (accepted trade-off, per spec):
// `getPostInlineImageUrl` is wrapped in `authQuery`, so any authenticated
// user can pass any `Id<"_storage">` and receive a fresh signed URL for it.
// We DO NOT add a per-call ownership check, because:
//   (a) Mirror's post bodies are predominantly publicly readable, so most
//       inline image URLs are already accessible to any reader of a published
//       post;
//   (b) `_storage` IDs are random tokens, not predictable, so an attacker
//       cannot enumerate them;
//   (c) the practical attack (extract a storageId from a draft body) requires
//       already having read access to the body, which means the image was
//       already accessible.
// If Mirror later supports private posts with stronger visibility rules,
// this query MUST be revisited and an ownership check added.

import { v } from "convex/values";
import { action, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import { authMutation, authQuery } from "../lib/auth";
import { authComponent } from "../auth/client";
import { type Id } from "../_generated/dataModel";

export const generatePostInlineImageUploadUrl = authMutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const getPostInlineImageUrl = authQuery({
  args: { storageId: v.id("_storage") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

// Sibling internal helper. We can't reuse `_readPostBody` for ownership
// because it strips `userId` from the doc. The action needs:
//   - to confirm the post exists
//   - to confirm the caller is the owner
//   - the caller's app-user `_id` to pass through as the internal action's
//     `ownerId` arg (FG_104 defense-in-depth re-check)
// before scheduling the SSRF-safe fetch + storage write. Returning a small
// shape (rather than the whole doc) keeps the trust boundary tight.
export const _getPostOwnership = internalQuery({
  args: { postId: v.id("posts"), authId: v.string() },
  returns: v.object({
    postExists: v.boolean(),
    isOwner: v.boolean(),
    appUserId: v.union(v.id("users"), v.null()),
  }),
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.postId);
    if (!post) {
      return { postExists: false, isOwner: false, appUserId: null };
    }
    const appUser = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", args.authId))
      .unique();
    if (!appUser) {
      return { postExists: true, isOwner: false, appUserId: null };
    }
    return {
      postExists: true,
      isOwner: post.userId === appUser._id,
      appUserId: appUser._id,
    };
  },
});

// Public wrapper for `internal.posts.actions.importMarkdownInlineImages`.
// The internal action does the actual SSRF-safe fetch + storage write. This
// wrapper enforces auth + ownership at the public-API boundary.
//
// FR-08 / FR-12: only the post's owner may trigger an inline-image import for
// it. We can't use `authMutation` here (this is an action; mutations cannot
// run "use node" code), so the auth + ownership check is open-coded against
// `authComponent.getAuthUser(ctx)` followed by an internal-query lookup.
export const importPostMarkdownInlineImages = action({
  args: { postId: v.id("posts") },
  returns: v.object({
    imported: v.number(),
    failed: v.number(),
    failures: v.array(
      v.object({ src: v.string(), reason: v.string() }),
    ),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    imported: number;
    failed: number;
    failures: { src: string; reason: string }[];
  }> => {
    // `getAuthUser` throws "Not authenticated" when there is no session.
    const authUser = await authComponent.getAuthUser(ctx);
    const ownership: {
      postExists: boolean;
      isOwner: boolean;
      appUserId: Id<"users"> | null;
    } = await ctx.runQuery(internal.posts.inlineImages._getPostOwnership, {
      postId: args.postId,
      authId: authUser._id as string,
    });
    if (!ownership.postExists) {
      throw new Error("Post not found");
    }
    if (!ownership.isOwner || ownership.appUserId === null) {
      throw new Error("Not authorized to import images for this post");
    }
    return await ctx.runAction(
      internal.posts.actions.importMarkdownInlineImages,
      {
        postId: args.postId,
        // FG_104: pass the verified owner so the internal action can
        // re-check defensively against the post row's userId.
        ownerId: ownership.appUserId,
      },
    );
  },
});
