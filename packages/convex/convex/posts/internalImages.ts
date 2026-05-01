// V8-runtime helpers for the inline-image markdown-import action.
//
// These exist as a sibling V8 file to `posts/actions.ts` (which declares
// `"use node"`). Convex requires V8 functions (queries, mutations) to live
// in non-`"use node"` files; the action calls them via `ctx.runQuery` and
// `ctx.runMutation`.

import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";

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
    return null;
  },
});
