import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { authMutation } from "../lib/auth";
import { getAppUser } from "../users/helpers";
import {
  isOwnedByUser,
  validateContentStringLength,
} from "../content/helpers";
import { assertValidSlug, generateSlug } from "../content/slug";
import { MAX_SLUG_LENGTH, MAX_TITLE_LENGTH } from "../content/schema";
import {
  extractInlineImageStorageIds,
  multisetDifference,
} from "../content/body-walk";
import { MAX_INLINE_DELETES_PER_INVOCATION } from "../content/storage-policy";

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

    // Always normalize: `generateSlug` is idempotent. See `.claude/rules/identifiers.md`.
    // Treat empty/whitespace-only client slug as "not supplied" and fall back
    // to the title.
    const slugSource = args.slug?.trim() ? args.slug : args.title;
    const slug = generateSlug(slugSource);
    validateContentStringLength(slug, "Slug", MAX_SLUG_LENGTH);
    assertValidSlug(slug);

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
    const articleId = await ctx.db.insert("articles", {
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

    if (args.status === "published") {
      await ctx.scheduler.runAfter(
        0,
        internal.embeddings.actions.generateEmbedding,
        { sourceTable: "articles" as const, sourceId: articleId },
      );
    }

    return articleId;
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
    if (args.category !== undefined) {
      validateContentStringLength(args.category, "Category", MAX_CATEGORY_LENGTH);
    }

    // Normalize incoming slug at the boundary. See `.claude/rules/identifiers.md`.
    // Empty/whitespace-only slug arg is treated as "no change requested" — a
    // no-op, NOT a failed normalize. Only normalize when the caller supplied a
    // non-empty value.
    let normalizedSlug: string | undefined;
    if (args.slug !== undefined && args.slug.trim() !== "") {
      normalizedSlug = generateSlug(args.slug);
      validateContentStringLength(normalizedSlug, "Slug", MAX_SLUG_LENGTH);
      assertValidSlug(normalizedSlug);
    }

    if (normalizedSlug && normalizedSlug !== article.slug) {
      const existing = await ctx.db
        .query("articles")
        .withIndex("by_userId_and_slug", (q) =>
          q.eq("userId", appUser._id).eq("slug", normalizedSlug),
        )
        .unique();
      if (existing) {
        throw new Error(`An article with slug "${normalizedSlug}" already exists`);
      }
    }

    // Clean up old cover image if being replaced
    // NOTE: cover-image delete-before-patch ordering is preserved as-is per
    // FR-06 (out of scope; would risk breaking existing mutations.test.ts).
    // The inline-image cascade below uses the after-patch ordering.
    if (
      args.coverImageStorageId !== undefined &&
      args.coverImageStorageId !== article.coverImageStorageId &&
      article.coverImageStorageId
    ) {
      await ctx.storage.delete(article.coverImageStorageId);
    }

    // Compute inline-image diff BEFORE the patch (we need both old and new
    // bodies). The actual `ctx.storage.delete` calls happen AFTER
    // `ctx.db.patch` so a failed write can't leave the article pointing at
    // deleted storage.
    //
    // The `.filter(id => !newSet.has(id))` line below is LOAD-BEARING — do
    // NOT remove it.
    //
    // `multisetDifference` returns IDs whose count dropped, including IDs
    // STILL PRESENT IN THE NEW BODY when `oldCount > newCount > 0`. Concrete
    // example: `[a, a, a] - [a]` returns `[a, a]`. If we deleted those, we
    // would delete a blob that the new body still references. The filter
    // discards every ID that newIds still contains, leaving only blobs whose
    // reference count fell to zero.
    //
    // The trailing `Array.from(new Set(diff))` deduplicates so the SAME
    // truly-orphaned blob isn't passed to `ctx.storage.delete` more than
    // once when it appeared multiple times in the old body.
    const removedInlineIds: Id<"_storage">[] = (() => {
      if (args.body === undefined) return [];
      const oldIds = extractInlineImageStorageIds(article.body);
      const newIds = extractInlineImageStorageIds(args.body);
      const newSet = new Set(newIds);
      const diff = multisetDifference(oldIds, newIds).filter(
        (id) => !newSet.has(id),
      );
      return Array.from(new Set(diff)) as Id<"_storage">[];
    })();

    const patch: ArticlePatch = {};
    if (args.title !== undefined) patch.title = args.title;
    // Only patch slug when it actually changes — avoids a redundant write and
    // a needless uniqueness probe when the caller round-trips the existing
    // value verbatim.
    if (normalizedSlug !== undefined && normalizedSlug !== article.slug) {
      patch.slug = normalizedSlug;
    }
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

    // After the patch succeeds, delete inline storage IDs that are no longer
    // referenced. Capped at MAX_INLINE_DELETES_PER_INVOCATION; any excess is
    // collected by the cron sweep (NFR-06). Each delete is guarded so a
    // single failure can't roll back the patch we already committed.
    const toDelete = removedInlineIds.slice(
      0,
      MAX_INLINE_DELETES_PER_INVOCATION,
    );
    for (const id of toDelete) {
      try {
        await ctx.storage.delete(id);
      } catch {
        // Ignore: blob may already be gone, or invalid Id from a legacy
        // body. The cron sweep is the safety net.
      }
    }

    // Schedule embedding update based on status change
    const newStatus = args.status ?? article.status;
    if (newStatus === "published") {
      const contentChanged =
        args.title !== undefined ||
        args.body !== undefined ||
        args.status !== undefined;
      if (contentChanged) {
        await ctx.scheduler.runAfter(
          0,
          internal.embeddings.actions.generateEmbedding,
          { sourceTable: "articles" as const, sourceId: args.id },
        );
      }
    } else if (args.status === "draft") {
      // Unpublished — remove embeddings
      await ctx.scheduler.runAfter(
        0,
        internal.embeddings.mutations.deleteBySource,
        { sourceTable: "articles" as const, sourceId: args.id },
      );
    }

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
      // Walk inline-image storage IDs BEFORE the row is deleted so we can
      // cascade-delete them after. Dedup so we don't try to delete the same
      // blob twice when the body referenced it more than once.
      const inlineIds = Array.from(
        new Set(extractInlineImageStorageIds(article.body)),
      ) as Id<"_storage">[];

      await ctx.db.delete(article._id);

      // Delete cover after the row is gone so a failed delete can't leave a
      // live article pointing at a missing asset.
      if (article.coverImageStorageId) {
        await ctx.storage.delete(article.coverImageStorageId);
      }

      // Capped at MAX_INLINE_DELETES_PER_INVOCATION (NFR-06); excess is
      // collected by the cron sweep.
      const inlineToDelete = inlineIds.slice(
        0,
        MAX_INLINE_DELETES_PER_INVOCATION,
      );
      for (const id of inlineToDelete) {
        try {
          await ctx.storage.delete(id);
        } catch {
          // Ignore: blob may not be a valid `_storage` Id (legacy bodies),
          // or the blob may already be gone. Either way the cron sweep is
          // the safety net.
        }
      }

      await ctx.scheduler.runAfter(
        0,
        internal.embeddings.mutations.deleteBySource,
        { sourceTable: "articles" as const, sourceId: article._id },
      );
    }

    return null;
  },
});

export const generateArticleCoverImageUploadUrl = authMutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});
