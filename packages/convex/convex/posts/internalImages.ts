// V8-runtime helpers for the inline-image markdown-import action.
//
// These exist as a sibling V8 file to `posts/actions.ts` (which declares
// `"use node"`). Convex requires V8 functions (queries, mutations) to live
// in non-`"use node"` files; the action calls them via `ctx.runQuery` and
// `ctx.runMutation`.

import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import { claimInlineImageOwnership } from "../content/inlineImageOwnership";

export const _readPostBody = internalQuery({
  args: { postId: v.id("posts") },
  returns: v.union(
    v.object({
      _id: v.id("posts"),
      body: v.any(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.postId);
    if (!post) return null;
    return { _id: post._id, body: post.body };
  },
});

export const _patchInlineImageBody = internalMutation({
  args: {
    postId: v.id("posts"),
    body: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.postId, { body: args.body });
    // FG_091: the markdown-import action just stored fresh blobs and
    // patched the body with their storageIds. Claim ownership for the
    // post's owner so a later same-user removal will cascade-delete them.
    // Look up the owner from the post doc — the action already verified
    // ownership before invoking us.
    const post = await ctx.db.get(args.postId);
    if (post) {
      await claimInlineImageOwnership(ctx, args.body, post.userId);
    }
    return null;
  },
});
