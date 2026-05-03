import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";
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
} from "../content/bodyWalk";
import {
  claimInlineImageOwnership,
  filterCallerOwnedInlineIds,
  filterUnreferencedStorageIds,
} from "../content/inlineImageOwnership";
import { MAX_INLINE_DELETES_PER_INVOCATION } from "../content/storagePolicy";
import {
  getPostCategoryForSlug,
  MAX_POST_CATEGORY_LENGTH,
} from "./categories";

type PostPatch = Partial<
  Omit<Doc<"posts">, "_id" | "_creationTime" | "userId" | "createdAt">
>;

export const create = authMutation({
  args: {
    title: v.string(),
    slug: v.optional(v.string()),
    category: v.string(),
    body: v.any(),
    status: v.union(v.literal("draft"), v.literal("published")),
    coverImageStorageId: v.optional(v.id("_storage")),
  },
  returns: v.id("posts"),
  handler: async (ctx, args) => {
    const appUser = await getAppUser(ctx, ctx.user._id);

    validateContentStringLength(args.title, "Title", MAX_TITLE_LENGTH);
    validateContentStringLength(
      args.category,
      "Category",
      MAX_POST_CATEGORY_LENGTH,
    );

    // Always normalize: `generateSlug` is idempotent, so already-clean slugs
    // pass through unchanged while malformed input gets sanitized. Never trust
    // the client to have done this. Treat empty/whitespace-only client slug as
    // "not supplied" and fall back to the title.
    // See `.claude/rules/identifiers.md`.
    const slugSource = args.slug?.trim() ? args.slug : args.title;
    const slug = generateSlug(slugSource);
    validateContentStringLength(slug, "Slug", MAX_SLUG_LENGTH);
    assertValidSlug(slug);

    const existing = await ctx.db
      .query("posts")
      .withIndex("by_userId_and_slug", (q) =>
        q.eq("userId", appUser._id).eq("slug", slug),
      )
      .unique();
    if (existing) {
      throw new Error(`A post with slug "${slug}" already exists`);
    }

    const now = Date.now();
    const postId = await ctx.db.insert("posts", {
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

    // FG_091: claim ownership for every inline-image storageId committed in
    // this body. First-commit-wins — see articles/mutations.ts for the
    // attack rationale.
    await claimInlineImageOwnership(ctx, args.body, appUser._id);

    if (args.status === "published") {
      await ctx.scheduler.runAfter(
        0,
        internal.embeddings.actions.generateEmbedding,
        { sourceTable: "posts" as const, sourceId: postId },
      );
    }

    return postId;
  },
});

export const update = authMutation({
  args: {
    id: v.id("posts"),
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
    const post = await ctx.db.get(args.id);
    if (!post) {
      throw new Error("Post not found");
    }
    if (!isOwnedByUser(post, appUser._id)) {
      throw new Error("Not authorized to update this post");
    }

    if (args.title !== undefined) {
      validateContentStringLength(args.title, "Title", MAX_TITLE_LENGTH);
    }
    if (args.category !== undefined) {
      validateContentStringLength(
        args.category,
        "Category",
        MAX_POST_CATEGORY_LENGTH,
      );
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

    if (normalizedSlug && normalizedSlug !== post.slug) {
      const existing = await ctx.db
        .query("posts")
        .withIndex("by_userId_and_slug", (q) =>
          q.eq("userId", appUser._id).eq("slug", normalizedSlug),
        )
        .unique();
      if (existing) {
        throw new Error(`A post with slug "${normalizedSlug}" already exists`);
      }
    }

    // Compute inline-image diff BEFORE the patch (we need both old and new
    // bodies). Actual `ctx.storage.delete` calls happen AFTER
    // `ctx.db.patch` so a failed write can't leave the post pointing at
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
      const oldIds = extractInlineImageStorageIds(post.body);
      const newIds = extractInlineImageStorageIds(args.body);
      const newSet = new Set(newIds);
      const diff = multisetDifference(oldIds, newIds).filter(
        (id) => !newSet.has(id),
      );
      return Array.from(new Set(diff)) as Id<"_storage">[];
    })();

    const patch: PostPatch = {};
    if (args.title !== undefined) patch.title = args.title;
    // Only patch slug when it actually changes — avoids a redundant write and
    // a needless uniqueness probe when the caller round-trips the existing
    // value verbatim.
    if (normalizedSlug !== undefined && normalizedSlug !== post.slug) {
      patch.slug = normalizedSlug;
    }
    if (args.category !== undefined) patch.category = args.category;
    if (args.body !== undefined) patch.body = args.body;
    if (args.coverImageStorageId !== undefined)
      patch.coverImageStorageId = args.coverImageStorageId;

    if (args.status !== undefined) {
      patch.status = args.status;
      if (args.status === "published" && !post.publishedAt) {
        patch.publishedAt = Date.now();
      }
    }

    await ctx.db.patch(args.id, patch);

    // Clean up the previous cover image only after the DB patch succeeds, so a
    // failed write can't leave the post pointing at deleted storage.
    if (
      args.coverImageStorageId !== undefined &&
      args.coverImageStorageId !== post.coverImageStorageId &&
      post.coverImageStorageId
    ) {
      await ctx.storage.delete(post.coverImageStorageId);
    }

    // FG_091: claim ownership for any new inline-image storageIds in the
    // committed body. Existing claims are left untouched (first-commit
    // wins).
    if (args.body !== undefined) {
      await claimInlineImageOwnership(ctx, args.body, appUser._id);
    }

    // Delete inline storage IDs that are no longer referenced. FG_091:
    // filter to IDs the ownership table attributes to the current caller —
    // refuses to delete blobs introduced by another user (the cross-user
    // storage-deletion attack). Legacy IDs (no ownership row) are silently
    // skipped; the cron sweep is the safety net.
    //
    // Capped at MAX_INLINE_DELETES_PER_INVOCATION; any excess is collected
    // by the cron sweep (NFR-06). Each delete is guarded so a single
    // failure can't roll back the patch we already committed.
    const callerOwned = await filterCallerOwnedInlineIds(
      ctx,
      removedInlineIds,
      appUser._id,
    );
    const toDelete = await filterUnreferencedStorageIds(
      ctx,
      callerOwned.slice(0, MAX_INLINE_DELETES_PER_INVOCATION),
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
    const newStatus = args.status ?? post.status;
    if (newStatus === "published") {
      const contentChanged =
        args.title !== undefined ||
        args.body !== undefined ||
        args.status !== undefined;
      if (contentChanged) {
        await ctx.scheduler.runAfter(
          0,
          internal.embeddings.actions.generateEmbedding,
          { sourceTable: "posts" as const, sourceId: args.id },
        );
      }
    } else if (args.status === "draft") {
      // Unpublished — remove embeddings
      await ctx.scheduler.runAfter(
        0,
        internal.embeddings.mutations.deleteBySource,
        { sourceTable: "posts" as const, sourceId: args.id },
      );
    }

    return null;
  },
});

export const remove = authMutation({
  args: { ids: v.array(v.id("posts")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const appUser = await getAppUser(ctx, ctx.user._id);

    const uniqueIds = [...new Set(args.ids)];
    const posts = await Promise.all(uniqueIds.map((id) => ctx.db.get(id)));
    const owned = posts.filter(
      (post): post is Doc<"posts"> =>
        post !== null && isOwnedByUser(post, appUser._id),
    );

    for (const post of owned) {
      // Walk inline-image storage IDs BEFORE the row is deleted so we can
      // cascade-delete them after. Dedup so we don't try to delete the same
      // blob twice when the body referenced it more than once.
      const inlineIds = Array.from(
        new Set(extractInlineImageStorageIds(post.body)),
      ) as Id<"_storage">[];

      await ctx.db.delete(post._id);

      // Delete storage after the DB row is gone so a failed delete can't
      // leave a live post pointing at a missing asset.
      if (post.coverImageStorageId) {
        await ctx.storage.delete(post.coverImageStorageId);
      }

      // FG_091: filter inline IDs to ones the caller owns per the
      // `inlineImageOwnership` table. Legacy IDs (no ownership row) are
      // silently skipped — the cron sweep is the safety net.
      //
      // Capped at MAX_INLINE_DELETES_PER_INVOCATION (NFR-06); excess is
      // collected by the cron sweep.
      const callerOwned = await filterCallerOwnedInlineIds(
        ctx,
        inlineIds,
        appUser._id,
      );
      const inlineToDelete = await filterUnreferencedStorageIds(
        ctx,
        callerOwned.slice(0, MAX_INLINE_DELETES_PER_INVOCATION),
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
        { sourceTable: "posts" as const, sourceId: post._id },
      );
    }

    return null;
  },
});

export const generatePostCoverImageUploadUrl = authMutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const backfillCategories = internalMutation({
  args: {},
  returns: v.object({
    scanned: v.number(),
    updated: v.number(),
  }),
  handler: async (ctx) => {
    const posts = await ctx.db.query("posts").collect();
    let updated = 0;

    for (const post of posts) {
      if (post.category?.trim()) {
        continue;
      }

      await ctx.db.patch(post._id, {
        category: getPostCategoryForSlug(post.slug),
      });
      updated += 1;
    }

    return {
      scanned: posts.length,
      updated,
    };
  },
});
