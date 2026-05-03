// V8-runtime helpers for the inline-image markdown-import action.
//
// These exist as a sibling V8 file to `articles/actions.ts` (which declares
// `"use node"`). Convex requires V8 functions (queries, mutations) to live
// in non-`"use node"` files; the action calls them via `ctx.runQuery` and
// `ctx.runMutation`.

import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import { claimInlineImageOwnership } from "../content/inlineImageOwnership";
import {
  mapInlineImages,
  type JSONContent,
} from "../content/bodyWalk";

export const _readArticleBody = internalQuery({
  args: { articleId: v.id("articles") },
  returns: v.union(
    v.object({
      _id: v.id("articles"),
      userId: v.id("users"),
      body: v.any(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const article = await ctx.db.get(args.articleId);
    if (!article) return null;
    // FG_104: surface `userId` so the markdown-import action can re-verify
    // ownership against the `ownerId` arg passed by the public wrapper.
    return { _id: article._id, userId: article.userId, body: article.body };
  },
});

// FG_096: merge-style patch instead of wholesale body replacement.
//
// The markdown-import action reads the body, performs N×up-to-10s external
// fetches, then patches. If the user edits the body during that window, a
// wholesale `ctx.db.patch(articleId, { body: stale })` silently overwrites
// their edits. Instead, the action passes a `srcMap` of original-src →
// `{ src, storageId }`; we re-read the CURRENT body inside the mutation
// transaction and rewrite only the image nodes whose `attrs.src` still
// matches a map entry.
//
// Image nodes whose original src is no longer in the body (user removed
// them mid-import) are silently skipped — the stored blob becomes an
// orphan candidate for the cron sweep. Image nodes added by the user
// during the race (with src not in srcMap) pass through unchanged.
export const _patchInlineImageBody = internalMutation({
  args: {
    articleId: v.id("articles"),
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
    const article = await ctx.db.get(args.articleId);
    if (!article) return null;

    const current = (article.body ?? null) as JSONContent | null;
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

    await ctx.db.patch(args.articleId, { body: merged });
    // FG_091: claim ownership for the article's owner so a later
    // same-user removal will cascade-delete the new blobs. Pass the
    // merged body so we only claim storageIds that actually landed —
    // not the ones the action resolved but the body no longer
    // references (those are orphan candidates).
    await claimInlineImageOwnership(ctx, merged, article.userId);
    return null;
  },
});
