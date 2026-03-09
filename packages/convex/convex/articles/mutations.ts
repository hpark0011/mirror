import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { authMutation } from "../lib/auth";
import { getAppUser } from "../users/helpers";
import {
  generateSlug,
  isOwnedByUser,
  validateContentStringLength,
} from "../content/helpers";
import { MAX_SLUG_LENGTH, MAX_TITLE_LENGTH } from "../content/schema";

const MAX_CATEGORY_LENGTH = 100;

export const create = authMutation({
  args: {
    title: v.string(),
    slug: v.optional(v.string()),
    category: v.string(),
    body: v.any(),
    status: v.union(v.literal("draft"), v.literal("published")),
    coverImageStorageId: v.optional(v.id("_storage")),
  },
  returns: v.id("articles"),
  handler: async (ctx, args) => {
    const appUser = await getAppUser(ctx, ctx.user._id);

    validateContentStringLength(args.title, "Title", MAX_TITLE_LENGTH);
    validateContentStringLength(args.category, "Category", MAX_CATEGORY_LENGTH);

    const slug = args.slug || generateSlug(args.title);
    validateContentStringLength(slug, "Slug", MAX_SLUG_LENGTH);

    if (!slug) {
      throw new Error("Slug cannot be empty");
    }

    const existing = await ctx.db
      .query("articles")
      .withIndex("by_userId_and_slug", (q) =>
        q.eq("userId", appUser._id).eq("slug", slug),
      )
      .unique();
    if (existing) {
      throw new Error(`An article with slug "${slug}" already exists`);
    }

    const now = Date.now();
    return await ctx.db.insert("articles", {
      userId: appUser._id,
      slug,
      title: args.title,
      category: args.category,
      body: args.body,
      status: args.status,
      coverImageStorageId: args.coverImageStorageId,
      createdAt: now,
      publishedAt: args.status === "published" ? now : undefined,
    });
  },
});

type ArticlePatch = Partial<
  Omit<Doc<"articles">, "_id" | "_creationTime" | "userId" | "createdAt">
>;

export const update = authMutation({
  args: {
    id: v.id("articles"),
    title: v.optional(v.string()),
    slug: v.optional(v.string()),
    category: v.optional(v.string()),
    body: v.optional(v.any()),
    status: v.optional(v.union(v.literal("draft"), v.literal("published"))),
    coverImageStorageId: v.optional(v.id("_storage")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const appUser = await getAppUser(ctx, ctx.user._id);
    const article = await ctx.db.get(args.id);
    if (!article) {
      throw new Error("Article not found");
    }
    if (!isOwnedByUser(article, appUser._id)) {
      throw new Error("Not authorized to update this article");
    }

    if (args.title !== undefined) {
      validateContentStringLength(args.title, "Title", MAX_TITLE_LENGTH);
    }
    if (args.slug !== undefined) {
      validateContentStringLength(args.slug, "Slug", MAX_SLUG_LENGTH);
    }
    if (args.category !== undefined) {
      validateContentStringLength(args.category, "Category", MAX_CATEGORY_LENGTH);
    }

    if (args.slug && args.slug !== article.slug) {
      const existing = await ctx.db
        .query("articles")
        .withIndex("by_userId_and_slug", (q) =>
          q.eq("userId", appUser._id).eq("slug", args.slug!),
        )
        .unique();
      if (existing) {
        throw new Error(`An article with slug "${args.slug}" already exists`);
      }
    }

    // Clean up old cover image if being replaced
    if (
      args.coverImageStorageId !== undefined &&
      args.coverImageStorageId !== article.coverImageStorageId &&
      article.coverImageStorageId
    ) {
      await ctx.storage.delete(article.coverImageStorageId);
    }

    const patch: ArticlePatch = {};
    if (args.title !== undefined) patch.title = args.title;
    if (args.slug !== undefined) patch.slug = args.slug;
    if (args.category !== undefined) patch.category = args.category;
    if (args.body !== undefined) patch.body = args.body;
    if (args.coverImageStorageId !== undefined)
      patch.coverImageStorageId = args.coverImageStorageId;

    if (args.status !== undefined) {
      patch.status = args.status;
      if (args.status === "published" && !article.publishedAt) {
        patch.publishedAt = Date.now();
      }
    }

    await ctx.db.patch(args.id, patch);
    return null;
  },
});

export const remove = authMutation({
  args: { ids: v.array(v.id("articles")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const appUser = await getAppUser(ctx, ctx.user._id);

    // Fetch all articles first and filter to owned ones only
    const uniqueIds = [...new Set(args.ids)];
    const articles = await Promise.all(uniqueIds.map((id) => ctx.db.get(id)));
    const owned = articles.filter(
      (a): a is Doc<"articles"> => a !== null && isOwnedByUser(a, appUser._id),
    );

    for (const article of owned) {
      if (article.coverImageStorageId) {
        await ctx.storage.delete(article.coverImageStorageId);
      }
      await ctx.db.delete(article._id);
    }

    return null;
  },
});

export const generateCoverImageUploadUrl = authMutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});
