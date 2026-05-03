// V8-runtime helpers for the inline-image markdown-import action.
//
// These exist as a sibling V8 file to `posts/actions.ts` (which declares
// `"use node"`). Convex requires V8 functions (queries, mutations) to live
// in non-`"use node"` files; the action calls them via `ctx.runQuery` and
// `ctx.runMutation`.

import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import { claimInlineImageOwnership } from "../content/inlineImageOwnership";
import {
  mapInlineImages,
  type JSONContent,
} from "../content/body-walk";

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

// FG_096: merge-style patch instead of wholesale body replacement.
// See `articles/internalImages.ts` for the full rationale — this is
// the post-side mirror.
export const _patchInlineImageBody = internalMutation({
  args: {
    postId: v.id("posts"),
    srcMap: v.record(
      v.string(),
      v.object({
        src: v.string(),
        storageId: v.id("_storage"),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.postId);
    if (!post) return null;

    const current = (post.body ?? null) as JSONContent | null;
    if (!current) return null;

    const merged = mapInlineImages(current, (attrs) => {
      if (!attrs) return attrs;
      const existing = attrs.storageId;
      if (typeof existing === "string" && existing.length > 0) {
        // Already imported — leave untouched (idempotent).
        return attrs;
      }
      const src = attrs.src;
      if (typeof src !== "string") return attrs;
      const update = args.srcMap[src];
      if (!update) return attrs;
      return { ...attrs, src: update.src, storageId: update.storageId };
    }) as JSONContent;

    await ctx.db.patch(args.postId, { body: merged });
    // FG_091: claim ownership for the post's owner so a later same-user
    // removal will cascade-delete the new blobs. Pass the merged body
    // so we only claim storageIds that actually landed.
    await claimInlineImageOwnership(ctx, merged, post.userId);
    return null;
  },
});
