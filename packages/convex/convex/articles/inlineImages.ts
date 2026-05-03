// Public mutations + queries for the inline-image lifecycle on articles.
//
// Read-side trust boundary (accepted trade-off, per spec):
// `getArticleInlineImageUrl` is wrapped in `authQuery`, so any authenticated
// user can pass any `Id<"_storage">` and receive a fresh signed URL for it.
// We DO NOT add a per-call ownership check, because:
//   (a) Mirror's article bodies are predominantly publicly readable, so most
//       inline image URLs are already accessible to any reader of a published
//       article;
//   (b) `_storage` IDs are random tokens, not predictable, so an attacker
//       cannot enumerate them;
//   (c) the practical attack (extract a storageId from a draft body) requires
//       already having read access to the body, which means the image was
//       already accessible.
// If Mirror later supports private articles with stronger visibility rules,
// this query MUST be revisited and an ownership check added.

import { v } from "convex/values";
import { action, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import { authMutation, authQuery } from "../lib/auth";
import { authComponent } from "../auth/client";
import { type Id } from "../_generated/dataModel";

export const generateArticleInlineImageUploadUrl = authMutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const getArticleInlineImageUrl = authQuery({
  args: { storageId: v.id("_storage") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

// Sibling internal helper. We can't reuse `_readArticleBody` for ownership
// because it strips `userId` from the doc. The action needs:
//   - to confirm the article exists
//   - to confirm the caller is the owner
//   - the caller's app-user `_id` to pass through as the internal action's
//     `ownerId` arg (FG_104 defense-in-depth re-check)
// before scheduling the SSRF-safe fetch + storage write. Returning a small
// shape (rather than the whole doc) keeps the trust boundary tight.
export const _getArticleOwnership = internalQuery({
  args: { articleId: v.id("articles"), authId: v.string() },
  returns: v.object({
    articleExists: v.boolean(),
    isOwner: v.boolean(),
    appUserId: v.union(v.id("users"), v.null()),
  }),
  handler: async (ctx, args) => {
    const article = await ctx.db.get(args.articleId);
    if (!article) {
      return { articleExists: false, isOwner: false, appUserId: null };
    }
    const appUser = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", args.authId))
      .unique();
    if (!appUser) {
      return { articleExists: true, isOwner: false, appUserId: null };
    }
    return {
      articleExists: true,
      isOwner: article.userId === appUser._id,
      appUserId: appUser._id,
    };
  },
});

// Public wrapper for `internal.articles.actions.importMarkdownInlineImages`.
// Same shape and rationale as `posts/inlineImages.ts` —
// see that file for the full FR-08 / FR-12 reasoning.
export const importArticleMarkdownInlineImages = action({
  args: { articleId: v.id("articles") },
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
    const authUser = await authComponent.getAuthUser(ctx);
    const ownership: {
      articleExists: boolean;
      isOwner: boolean;
      appUserId: Id<"users"> | null;
    } = await ctx.runQuery(
      internal.articles.inlineImages._getArticleOwnership,
      {
        articleId: args.articleId,
        authId: authUser._id as string,
      },
    );
    if (!ownership.articleExists) {
      throw new Error("Article not found");
    }
    if (!ownership.isOwner || ownership.appUserId === null) {
      throw new Error("Not authorized to import images for this article");
    }
    return await ctx.runAction(
      internal.articles.actions.importMarkdownInlineImages,
      {
        articleId: args.articleId,
        // FG_104: pass the verified owner so the internal action can
        // re-check defensively against the article row's userId.
        ownerId: ownership.appUserId,
      },
    );
  },
});
