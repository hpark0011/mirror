import { ConvexError, v } from "convex/values";
import { type Doc, type Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { action, internalMutation } from "../_generated/server";
import { authMutation } from "../lib/auth";
import { getAppUser } from "../users/helpers";
import {
  isOwnedByUser,
  validateContentStringLength,
} from "../content/helpers";
import { assertValidSlug, generateSlug } from "../content/slug";
import { MAX_SLUG_LENGTH, MAX_TITLE_LENGTH } from "../content/schema";
import { validateThumbhashFormat } from "../articles/helpers";
import {
  extractInlineImageStorageIds,
  hasExternalImageSrcs,
  multisetDifference,
} from "../content/bodyWalk";
import {
  claimInlineImageOwnership,
  filterCallerOwnedInlineIds,
  filterUnreferencedStorageIds,
} from "../content/inlineImageOwnership";
import { collectReferencedFromCandidates } from "../content/storageRegistry";
import {
  assertCoverBlobOwnership,
  claimCoverBlobOwnershipFromAction,
  deleteCoverBlobAndOwnership,
  filterCallerOwnedCoverBlobIds,
} from "../content/coverBlobOwnership";
import {
  ALLOWED_INLINE_IMAGE_TYPES,
  ALLOWED_COVER_VIDEO_TYPES,
  MAX_COVER_VIDEO_BYTES,
  MAX_INLINE_DELETES_PER_INVOCATION,
  MAX_INLINE_IMAGE_BYTES,
} from "../content/storagePolicy";
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
    coverImageThumbhash: v.optional(v.string()),
    // Optional MP4 cover. The poster is mandatory whenever the video is set
    // so `<video poster>` has a frame to show before metadata loads. Image
    // and video are mutually exclusive — supplying both is rejected at the
    // mutation boundary.
    coverVideoStorageId: v.optional(v.id("_storage")),
    coverVideoPosterStorageId: v.optional(v.id("_storage")),
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
    if (args.coverImageThumbhash !== undefined) {
      validateThumbhashFormat(args.coverImageThumbhash);
    }

    // Image and video covers are mutually exclusive. Reject upstream so
    // the schema invariant "at most one cover kind set per row" can be
    // relied on by the render-precedence rule.
    if (
      args.coverImageStorageId !== undefined &&
      args.coverVideoStorageId !== undefined
    ) {
      throw new ConvexError(
        "cover image and cover video are mutually exclusive — supply at most one",
      );
    }
    if (
      args.coverVideoStorageId !== undefined &&
      args.coverVideoPosterStorageId === undefined
    ) {
      throw new ConvexError("cover video requires a sibling poster storage id");
    }
    if (
      args.coverVideoPosterStorageId !== undefined &&
      args.coverVideoStorageId === undefined
    ) {
      throw new ConvexError(
        "cover video poster requires a sibling cover video storage id",
      );
    }

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

    // FG_148: Reject bodies with external image src URLs (no storageId set).
    // Editor-authored bodies always set storageId for inserted images; this
    // guard catches direct mutation calls with attacker-controlled URLs.
    if (hasExternalImageSrcs(args.body)) {
      throw new ConvexError(
        "body contains image nodes with external src URLs; use the storage upload flow",
      );
    }

    // Verify every cover blob belongs to the calling user before writing.
    if (args.coverImageStorageId !== undefined) {
      await assertCoverBlobOwnership(
        ctx,
        args.coverImageStorageId,
        appUser._id,
        "image",
      );
    }
    if (args.coverVideoStorageId !== undefined) {
      await assertCoverBlobOwnership(
        ctx,
        args.coverVideoStorageId,
        appUser._id,
        "video",
      );
    }
    if (args.coverVideoPosterStorageId !== undefined) {
      await assertCoverBlobOwnership(
        ctx,
        args.coverVideoPosterStorageId,
        appUser._id,
        "poster",
      );
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
      coverImageThumbhash: args.coverImageThumbhash,
      coverVideoStorageId: args.coverVideoStorageId,
      coverVideoPosterStorageId: args.coverVideoPosterStorageId,
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
    coverImageThumbhash: v.optional(v.string()),
    coverVideoStorageId: v.optional(v.id("_storage")),
    coverVideoPosterStorageId: v.optional(v.id("_storage")),
    // Explicit removal signal for the whole cover surface. Optional storage
    // args cannot distinguish "user cleared the cover" from "user did not
    // touch the cover" once validation has run.
    clearCover: v.optional(v.boolean()),
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
    if (args.coverImageThumbhash !== undefined) {
      validateThumbhashFormat(args.coverImageThumbhash);
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

    // FG_148: Reject bodies with external image src URLs.
    if (args.body !== undefined && hasExternalImageSrcs(args.body)) {
      throw new ConvexError(
        "body contains image nodes with external src URLs; use the storage upload flow",
      );
    }

    // Image and video covers are mutually exclusive on update too.
    if (
      args.coverImageStorageId !== undefined &&
      args.coverVideoStorageId !== undefined
    ) {
      throw new ConvexError(
        "cover image and cover video are mutually exclusive — supply at most one",
      );
    }
    if (
      args.coverVideoStorageId !== undefined &&
      args.coverVideoPosterStorageId === undefined
    ) {
      throw new ConvexError("cover video requires a sibling poster storage id");
    }
    if (
      args.coverVideoPosterStorageId !== undefined &&
      args.coverVideoStorageId === undefined
    ) {
      throw new ConvexError(
        "cover video poster requires a sibling cover video storage id",
      );
    }

    // Verify every cover blob the caller is committing belongs to them.
    if (args.coverImageStorageId !== undefined) {
      await assertCoverBlobOwnership(
        ctx,
        args.coverImageStorageId,
        appUser._id,
        "image",
      );
    }
    if (args.coverVideoStorageId !== undefined) {
      await assertCoverBlobOwnership(
        ctx,
        args.coverVideoStorageId,
        appUser._id,
        "video",
      );
    }
    if (args.coverVideoPosterStorageId !== undefined) {
      await assertCoverBlobOwnership(
        ctx,
        args.coverVideoPosterStorageId,
        appUser._id,
        "poster",
      );
    }

    // Compute inline-image diff BEFORE the patch (we need both old and new
    // bodies). Actual `ctx.storage.delete` calls happen AFTER `ctx.db.patch`
    // so a failed write can't leave the post pointing at deleted storage.
    //
    // The `.filter(id => !newSet.has(id))` line below is LOAD-BEARING — see
    // articles/mutations.ts for the multiset-difference rationale.
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

    // Cover patch coupling. Mirrors articles/mutations.ts: the row carries
    // two parallel cover surfaces (image + thumbhash, video + poster). They
    // are mutually exclusive at the row level — the patch always clears the
    // not-chosen surface so a future read can rely on "video wins iff
    // coverVideoStorageId is set, else image".
    let replacedImage = false;
    let replacedVideo = false;
    let replacedPoster = false;
    let clearedAllCover = false;

    if (args.clearCover === true) {
      patch.coverImageStorageId = undefined;
      patch.coverImageThumbhash = undefined;
      patch.coverVideoStorageId = undefined;
      patch.coverVideoPosterStorageId = undefined;
      clearedAllCover = true;
    } else if (
      args.coverVideoStorageId !== undefined &&
      (args.coverVideoStorageId !== post.coverVideoStorageId ||
        args.coverVideoPosterStorageId !== post.coverVideoPosterStorageId)
    ) {
      patch.coverVideoStorageId = args.coverVideoStorageId;
      patch.coverVideoPosterStorageId = args.coverVideoPosterStorageId;
      patch.coverImageStorageId = undefined;
      patch.coverImageThumbhash = undefined;
      replacedVideo = args.coverVideoStorageId !== post.coverVideoStorageId;
      replacedPoster =
        args.coverVideoPosterStorageId !== post.coverVideoPosterStorageId;
    } else if (
      args.coverImageStorageId !== undefined &&
      args.coverImageStorageId !== post.coverImageStorageId
    ) {
      patch.coverImageStorageId = args.coverImageStorageId;
      patch.coverImageThumbhash = args.coverImageThumbhash;
      patch.coverVideoStorageId = undefined;
      patch.coverVideoPosterStorageId = undefined;
      replacedImage = true;
    } else if (args.coverImageThumbhash !== undefined) {
      patch.coverImageThumbhash = args.coverImageThumbhash;
    }

    if (args.status !== undefined) {
      patch.status = args.status;
      if (args.status === "published" && !post.publishedAt) {
        patch.publishedAt = Date.now();
      }
    }

    await ctx.db.patch(args.id, patch);

    // After the patch succeeds, cascade-delete blobs the patch made
    // unreferenced. ctx.storage.delete is not transactional — a failure
    // here must not roll back the patch we already committed, so each
    // delete is guarded and the cron sweep is the safety net.
    if (clearedAllCover || replacedVideo || replacedImage) {
      if (post.coverImageStorageId) {
        await deleteCoverBlobAndOwnership(ctx, post.coverImageStorageId);
      }
      if (post.coverVideoStorageId) {
        await deleteCoverBlobAndOwnership(ctx, post.coverVideoStorageId);
      }
    }
    // Reusing the same poster id across a video swap means the old poster IS
    // the new poster — deletion would delete the live blob. Omit
    // `replacedVideo` here and delete only when the poster id changed, the
    // cover is cleared, or an image replacement vacates the video surface.
    if (clearedAllCover || replacedImage || replacedPoster) {
      if (post.coverVideoPosterStorageId) {
        await deleteCoverBlobAndOwnership(ctx, post.coverVideoPosterStorageId);
      }
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

      // Cascade-delete cover blobs after the row is gone. Best-effort: a
      // failed storage delete leaves an orphan, never a live post pointing
      // at a missing asset. The orphan-sweep cron reclaims survivors.
      await deleteCoverBlobAndOwnership(ctx, post.coverImageStorageId);
      await deleteCoverBlobAndOwnership(ctx, post.coverVideoStorageId);
      await deleteCoverBlobAndOwnership(ctx, post.coverVideoPosterStorageId);

      // FG_091: filter inline IDs to ones the caller owns per the
      // `inlineImageOwnership` table. Legacy IDs (no ownership row) are
      // silently skipped — the cron sweep is the safety net.
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

/**
 * Internal mutation powering the chat agent's `deletePost` tool. Mirrors the
 * single-post slice of `remove` but with two key differences:
 *
 *  1. Caller is the chat action (no `ctx.user`), so this is `internalMutation`
 *     with an explicit `userId` arg. The arg is server-derived in the tool
 *     factory's closure (`profileOwnerId`) and is NEVER reachable from the
 *     LLM-visible `inputSchema`. See `.claude/rules/agent-parity.md` and
 *     `.claude/rules/embeddings.md` — same cross-user isolation invariant the
 *     RAG vector-search uses.
 *
 *  2. Identifies the post by `(userId, slug)` via the `by_userId_and_slug`
 *     compound index. Slug-not-found and cross-user collisions both return
 *     `{ deleted: false }` rather than throwing — so a stale slug from the
 *     LLM (typo, hallucination, or already-deleted) surfaces as a normal
 *     tool result the agent can recover from in text, not as an error.
 */
export const deleteByUserAndSlug = internalMutation({
  args: {
    userId: v.id("users"),
    slug: v.string(),
  },
  returns: v.union(
    v.object({
      deleted: v.literal(true),
      title: v.string(),
      slug: v.string(),
    }),
    v.object({
      deleted: v.literal(false),
      slug: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const post = await ctx.db
      .query("posts")
      .withIndex("by_userId_and_slug", (q) =>
        q.eq("userId", args.userId).eq("slug", args.slug),
      )
      .unique();

    if (!post || !isOwnedByUser(post, args.userId)) {
      return { deleted: false as const, slug: args.slug };
    }

    const inlineIds = Array.from(
      new Set(extractInlineImageStorageIds(post.body)),
    ) as Id<"_storage">[];

    await ctx.db.delete(post._id);

    await deleteCoverBlobAndOwnership(ctx, post.coverImageStorageId);
    await deleteCoverBlobAndOwnership(ctx, post.coverVideoStorageId);
    await deleteCoverBlobAndOwnership(ctx, post.coverVideoPosterStorageId);

    const callerOwned = await filterCallerOwnedInlineIds(
      ctx,
      inlineIds,
      args.userId,
    );
    const inlineToDelete = await filterUnreferencedStorageIds(
      ctx,
      callerOwned.slice(0, MAX_INLINE_DELETES_PER_INVOCATION),
    );
    for (const id of inlineToDelete) {
      try {
        await ctx.storage.delete(id);
      } catch {
        // Cron sweep is the safety net.
      }
    }

    await ctx.scheduler.runAfter(
      0,
      internal.embeddings.mutations.deleteBySource,
      { sourceTable: "posts" as const, sourceId: post._id },
    );

    return { deleted: true as const, title: post.title, slug: post.slug };
  },
});

export const generatePostCoverImageUploadUrl = authMutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

// FG_147: After a cover image upload completes, the client calls this action
// to record ownership. Trust boundary: userId is derived server-side from
// `getAppUser` — never from args. Args validator MUST NOT include `userId`.
export const claimPostCoverImageOwnership = action({
  args: {
    storageId: v.id("_storage"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    return await claimCoverBlobOwnershipFromAction(ctx, args, {
      kind: "image",
      label: "cover image",
      allowedTypes: ALLOWED_INLINE_IMAGE_TYPES,
      maxBytes: MAX_INLINE_IMAGE_BYTES,
    });
  },
});

export const generatePostCoverVideoUploadUrls = authMutation({
  args: {},
  returns: v.object({
    videoUrl: v.string(),
    posterUrl: v.string(),
  }),
  handler: async (ctx) => {
    const [videoUrl, posterUrl] = await Promise.all([
      ctx.storage.generateUploadUrl(),
      ctx.storage.generateUploadUrl(),
    ]);
    return { videoUrl, posterUrl };
  },
});

// PLAN_010: After the MP4 upload completes the client calls this action to
// record ownership AND server-side validate the blob's MIME + size. Args
// validator MUST NOT include a `userId` field.
export const claimPostCoverVideoOwnership = action({
  args: {
    storageId: v.id("_storage"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    return await claimCoverBlobOwnershipFromAction(ctx, args, {
      kind: "video",
      label: "cover video",
      allowedTypes: ALLOWED_COVER_VIDEO_TYPES,
      maxBytes: MAX_COVER_VIDEO_BYTES,
    });
  },
});

// PLAN_010: claim ownership for the JPEG poster the client extracts from
// the MP4. The poster is an image, so we validate against the inline-image
// MIME+size policy.
export const claimPostCoverVideoPosterOwnership = action({
  args: {
    storageId: v.id("_storage"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    return await claimCoverBlobOwnershipFromAction(ctx, args, {
      kind: "poster",
      label: "cover video poster",
      allowedTypes: ALLOWED_INLINE_IMAGE_TYPES,
      maxBytes: MAX_INLINE_IMAGE_BYTES,
    });
  },
});

// FG_129: Eagerly clean up a cover-image storage blob that was uploaded
// before a `create` call that subsequently failed (e.g. slug collision).
// Verifies caller owns the blob, then checks the canonical storage registry
// for live references before deleting.
export const deleteOrphanCoverImage = authMutation({
  args: {
    storageId: v.id("_storage"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const appUser = await getAppUser(ctx, ctx.user._id);
    const callerOwnedIds = await filterCallerOwnedCoverBlobIds(
      ctx,
      [args.storageId],
      appUser._id,
    );
    const referenced = await collectReferencedFromCandidates(
      ctx,
      callerOwnedIds,
    );

    for (const storageId of callerOwnedIds) {
      if (!referenced.has(storageId)) {
        await deleteCoverBlobAndOwnership(ctx, storageId);
      }
    }

    return null;
  },
});

// PLAN_010: Eagerly clean up the video + poster blobs uploaded before a
// `create` that subsequently failed.
export const deleteOrphanCoverVideo = authMutation({
  args: {
    videoStorageId: v.optional(v.id("_storage")),
    posterStorageId: v.optional(v.id("_storage")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (
      args.videoStorageId === undefined &&
      args.posterStorageId === undefined
    ) {
      return null;
    }

    const appUser = await getAppUser(ctx, ctx.user._id);
    const candidates = [
      ...(args.videoStorageId !== undefined ? [args.videoStorageId] : []),
      ...(args.posterStorageId !== undefined ? [args.posterStorageId] : []),
    ];
    const callerOwnedIds = await filterCallerOwnedCoverBlobIds(
      ctx,
      candidates,
      appUser._id,
    );
    const referenced = await collectReferencedFromCandidates(
      ctx,
      callerOwnedIds,
    );

    for (const storageId of callerOwnedIds) {
      if (!referenced.has(storageId)) {
        await deleteCoverBlobAndOwnership(ctx, storageId);
      }
    }

    return null;
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
