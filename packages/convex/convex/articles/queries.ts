import { query } from "../_generated/server";
import { v } from "convex/values";
import {
  articleSummaryReturnValidator,
  articleWithBodyReturnValidator,
  conversationArticleReturnValidator,
  resolveCoverImageUrl,
} from "./helpers";
import {
  filterVisibleContent,
  getUserAndContentAccess,
} from "../content/helpers";

export const getByUsername = query({
  args: { username: v.string() },
  returns: v.union(v.array(articleSummaryReturnValidator), v.null()),
  handler: async (ctx, args) => {
    const access = await getUserAndContentAccess(ctx, args.username);
    if (!access) {
      return null;
    }

    const { user, isOwner } = access;

    const articles = await ctx.db
      .query("articles")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    const visible = filterVisibleContent(articles, isOwner);

    const coverImageUrls = await Promise.all(
      visible.map((a) => resolveCoverImageUrl(ctx, a.coverImageStorageId)),
    );

    return visible.map((article, i) => ({
      _id: article._id,
      _creationTime: article._creationTime,
      userId: article.userId,
      slug: article.slug,
      title: article.title,
      coverImageUrl: coverImageUrls[i]!,
      createdAt: article.createdAt,
      publishedAt: article.publishedAt,
      status: article.status,
      category: article.category,
    }));
  },
});

export const getByUsernameForConversation = query({
  args: { username: v.string() },
  returns: v.union(v.array(conversationArticleReturnValidator), v.null()),
  handler: async (ctx, args) => {
    const access = await getUserAndContentAccess(ctx, args.username);
    if (!access) {
      return null;
    }

    const { user, isOwner } = access;
    const articles = await ctx.db
      .query("articles")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    return filterVisibleContent(articles, isOwner).map((article) => ({
      title: article.title,
      body: article.body,
    }));
  },
});

export const getBySlug = query({
  args: { username: v.string(), slug: v.string() },
  returns: v.union(articleWithBodyReturnValidator, v.null()),
  handler: async (ctx, args) => {
    const access = await getUserAndContentAccess(ctx, args.username);
    if (!access) {
      return null;
    }

    const { user, isOwner } = access;

    const article = await ctx.db
      .query("articles")
      .withIndex("by_userId_and_slug", (q) =>
        q.eq("userId", user._id).eq("slug", args.slug),
      )
      .unique();
    if (!article) {
      return null;
    }

    if (article.status === "draft" && !isOwner) {
      return null;
    }

    const coverImageUrl = await resolveCoverImageUrl(
      ctx,
      article.coverImageStorageId,
    );

    return {
      _id: article._id,
      _creationTime: article._creationTime,
      userId: article.userId,
      slug: article.slug,
      title: article.title,
      coverImageUrl,
      createdAt: article.createdAt,
      publishedAt: article.publishedAt,
      status: article.status,
      category: article.category,
      body: article.body,
    };
  },
});
