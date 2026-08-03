import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { type Id } from "../_generated/dataModel";
import { isOwnedByUser } from "../content/helpers";
import { contentStatusValidator } from "../content/schema";
import { deleteArticleForUserBySlug } from "../articles/writeHelpers";

type ContentStatus = "draft" | "published";

const statusMutationReturnValidator = v.union(
  v.object({
    updated: v.literal(true),
    changed: v.boolean(),
    kind: v.union(v.literal("articles"), v.literal("posts")),
    slug: v.string(),
    title: v.string(),
    status: contentStatusValidator,
    previousStatus: contentStatusValidator,
    publishedAt: v.optional(v.number()),
  }),
  v.object({
    updated: v.literal(false),
    kind: v.union(v.literal("articles"), v.literal("posts")),
    slug: v.string(),
    status: contentStatusValidator,
  }),
);

const deleteArticleReturnValidator = v.union(
  v.object({
    deleted: v.literal(true),
    title: v.string(),
    slug: v.string(),
  }),
  v.object({
    deleted: v.literal(false),
    slug: v.string(),
  }),
);

async function setStatusForPost(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    slug: string;
    status: ContentStatus;
  },
) {
  const post = await ctx.db
    .query("posts")
    .withIndex("by_userId_and_slug", (q) =>
      q.eq("userId", args.userId).eq("slug", args.slug),
    )
    .unique();

  if (!post || !isOwnedByUser(post, args.userId)) {
    return {
      updated: false as const,
      kind: "posts" as const,
      slug: args.slug,
      status: args.status,
    };
  }

  const previousStatus = post.status;
  const changed = previousStatus !== args.status;
  let publishedAt = post.publishedAt;

  if (changed || (args.status === "published" && !publishedAt)) {
    const patch: {
      status: ContentStatus;
      publishedAt?: number;
    } = { status: args.status };
    if (args.status === "published" && !publishedAt) {
      publishedAt = Date.now();
      patch.publishedAt = publishedAt;
    }
    await ctx.db.patch(post._id, patch);
  }

  if (changed) {
    if (args.status === "published") {
      await ctx.scheduler.runAfter(
        0,
        internal.embeddings.actions.generateEmbedding,
        { sourceTable: "posts" as const, sourceId: post._id },
      );
    } else {
      await ctx.scheduler.runAfter(
        0,
        internal.embeddings.mutations.deleteBySource,
        { sourceTable: "posts" as const, sourceId: post._id },
      );
    }
  }

  return {
    updated: true as const,
    changed,
    kind: "posts" as const,
    slug: post.slug,
    title: post.title,
    status: args.status,
    previousStatus,
    publishedAt,
  };
}

async function setStatusForArticle(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    slug: string;
    status: ContentStatus;
  },
) {
  const article = await ctx.db
    .query("articles")
    .withIndex("by_userId_and_slug", (q) =>
      q.eq("userId", args.userId).eq("slug", args.slug),
    )
    .unique();

  if (!article || !isOwnedByUser(article, args.userId)) {
    return {
      updated: false as const,
      kind: "articles" as const,
      slug: args.slug,
      status: args.status,
    };
  }

  const previousStatus = article.status;
  const changed = previousStatus !== args.status;
  let publishedAt = article.publishedAt;

  if (changed || (args.status === "published" && !publishedAt)) {
    const patch: {
      status: ContentStatus;
      publishedAt?: number;
    } = { status: args.status };
    if (args.status === "published" && !publishedAt) {
      publishedAt = Date.now();
      patch.publishedAt = publishedAt;
    }
    await ctx.db.patch(article._id, patch);
  }

  if (changed) {
    if (args.status === "published") {
      await ctx.scheduler.runAfter(
        0,
        internal.embeddings.actions.generateEmbedding,
        { sourceTable: "articles" as const, sourceId: article._id },
      );
    } else {
      await ctx.scheduler.runAfter(
        0,
        internal.embeddings.mutations.deleteBySource,
        { sourceTable: "articles" as const, sourceId: article._id },
      );
    }
  }

  return {
    updated: true as const,
    changed,
    kind: "articles" as const,
    slug: article.slug,
    title: article.title,
    status: args.status,
    previousStatus,
    publishedAt,
  };
}

export const setPostStatusByUserAndSlug = internalMutation({
  args: {
    userId: v.id("users"),
    slug: v.string(),
    status: contentStatusValidator,
  },
  returns: statusMutationReturnValidator,
  handler: async (ctx, args) => {
    return await setStatusForPost(ctx, args);
  },
});

export const setArticleStatusByUserAndSlug = internalMutation({
  args: {
    userId: v.id("users"),
    slug: v.string(),
    status: contentStatusValidator,
  },
  returns: statusMutationReturnValidator,
  handler: async (ctx, args) => {
    return await setStatusForArticle(ctx, args);
  },
});

export const deleteArticleByUserAndSlug = internalMutation({
  args: {
    userId: v.id("users"),
    slug: v.string(),
  },
  returns: deleteArticleReturnValidator,
  handler: async (ctx, args) => {
    return await deleteArticleForUserBySlug(ctx, args.userId, args.slug);
  },
});
