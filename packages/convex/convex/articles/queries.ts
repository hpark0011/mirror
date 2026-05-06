import { internalQuery, query } from "../_generated/server";
import { v } from "convex/values";
import {
  articleSummaryReturnValidator,
  articleWithBodyReturnValidator,
  conversationArticleReturnValidator,
  resolveArticleCoverImageUrl,
} from "./helpers";
import {
  filterVisibleContent,
  getUserAndContentAccess,
} from "../content/helpers";
import {
  extractInlineImageStorageIds,
  mapInlineImages,
} from "../content/bodyWalk";
import type { Id } from "../_generated/dataModel";

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
      visible.map((a) => resolveArticleCoverImageUrl(ctx, a.coverImageStorageId)),
    );

    return visible.map((article, i) => ({
      _id: article._id,
      _creationTime: article._creationTime,
      userId: article.userId,
      slug: article.slug,
      title: article.title,
      coverImageUrl: coverImageUrls[i]!,
      coverImageThumbhash: article.coverImageThumbhash ?? null,
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

    const coverImageUrl = await resolveArticleCoverImageUrl(
      ctx,
      article.coverImageStorageId,
    );

    // Rewrite inline image `src` from `storageId` so the body always renders
    // with a fresh signed URL (FR-05). `mapInlineImages` is sync, so we
    // pre-resolve every URL via Promise.all and stash them in a Map for the
    // mapper to look up. Image nodes lacking a `storageId` keep their
    // existing `src` (legacy external URLs).
    const storageIds = extractInlineImageStorageIds(article.body);
    const uniqueIds = Array.from(new Set(storageIds));
    const urls = await Promise.all(
      uniqueIds.map((id) => ctx.storage.getUrl(id as Id<"_storage">)),
    );
    const urlByStorageId = new Map<string, string | null>();
    for (let i = 0; i < uniqueIds.length; i++) {
      urlByStorageId.set(uniqueIds[i]!, urls[i] ?? null);
    }
    const rewrittenBody = mapInlineImages(article.body, (attrs) => {
      if (!attrs) return attrs;
      const sid = attrs.storageId;
      if (typeof sid !== "string" || sid.length === 0) return attrs;
      const resolved = urlByStorageId.get(sid);
      if (resolved == null) {
        // Missing blob: leave `src` empty so the <img> fails to load locally
        // rather than rendering a stale signed URL. Spec edge-case:
        // "ctx.storage.getUrl(storageId) returns null when blob is gone —
        //  Query-time fallback: leave `src` empty."
        return { ...attrs, src: "" };
      }
      return { ...attrs, src: resolved };
    });

    return {
      _id: article._id,
      _creationTime: article._creationTime,
      userId: article.userId,
      slug: article.slug,
      title: article.title,
      coverImageUrl,
      coverImageThumbhash: article.coverImageThumbhash ?? null,
      createdAt: article.createdAt,
      publishedAt: article.publishedAt,
      status: article.status,
      category: article.category,
      body: rewrittenBody,
    };
  },
});

export const listMissingThumbhash = internalQuery({
  // Paginated scan for the backfill. Without a cursor loop, `.collect()`
  // hits Convex's 16k document read cap once an account accumulates that
  // many articles. The backfill (`scripts/backfill-cover-thumbhash.ts`)
  // drives this with a cursor loop and a fixed page size.
  //
  // There is no index keyed on the absence of a thumbhash, so the page is
  // filtered in JS after the table scan. The script keeps paginating until
  // `isDone` is true; pages may legitimately come back empty when every row
  // in the page already has a thumbhash.
  args: { cursor: v.union(v.string(), v.null()), numItems: v.number() },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("articles"),
        coverImageStorageId: v.id("_storage"),
      }),
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("articles")
      .paginate({ cursor: args.cursor, numItems: args.numItems });
    return {
      page: result.page
        .filter(
          (a) =>
            a.coverImageStorageId !== undefined &&
            a.coverImageThumbhash === undefined,
        )
        .map((a) => ({
          _id: a._id,
          coverImageStorageId: a.coverImageStorageId!,
        })),
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

export const getCoverUrl = internalQuery({
  args: { storageId: v.id("_storage") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});
