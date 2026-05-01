// V8-runtime helpers for the inline-image markdown-import action.
//
// These exist as a sibling V8 file to `articles/actions.ts` (which declares
// `"use node"`). Convex requires V8 functions (queries, mutations) to live
// in non-`"use node"` files; the action calls them via `ctx.runQuery` and
// `ctx.runMutation`.

import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";

export const _readArticleBody = internalQuery({
  args: { articleId: v.id("articles") },
  returns: v.union(
    v.object({
      _id: v.id("articles"),
      body: v.any(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const article = await ctx.db.get(args.articleId);
    if (!article) return null;
    return { _id: article._id, body: article.body };
  },
});

export const _patchInlineImageBody = internalMutation({
  args: {
    articleId: v.id("articles"),
    body: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.articleId, { body: args.body });
    return null;
  },
});
