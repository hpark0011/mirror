import { ConvexError, v } from "convex/values";
import { type Doc, type Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";
import { authMutation } from "../lib/auth";
import { getAppUser } from "../users/helpers";
import {
  isOwnedByUser,
  validateContentStringLength,
} from "../content/helpers";
import { assertValidSlug, generateSlug } from "../content/slug";
import {
  MAX_CATEGORY_LENGTH,
  MAX_SLUG_LENGTH,
  MAX_TITLE_LENGTH,
} from "../content/schema";
import { validateThumbhashFormat } from "./helpers";
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
import {
  ALLOWED_COVER_VIDEO_TYPES,
  MAX_COVER_VIDEO_BYTES,
  MAX_INLINE_DELETES_PER_INVOCATION,
  MAX_INLINE_IMAGE_BYTES,
} from "../content/storagePolicy";
import { type MutationCtx } from "../_generated/server";

// FG_147 / PLAN_010: Verify that `storageId` belongs to `userId` via the
// `coverImageOwnership` table. Throws `ConvexError` if the row is missing
// or attributed to a different user.
//
// Called from `create` and `update` before writing any cover-blob storage
// id (image, video, or video poster). Args validators for mutations that
// write a cover storage id MUST NOT include `userId` — it is always
// derived server-side from `getAppUser`. See `.claude/rules/embeddings.md`.
async function assertCoverBlobOwnership(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
  userId: Id<"users">,
): Promise<void> {
  const row = await ctx.db
    .query("coverImageOwnership")
    .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
    .unique();
  if (!row || row.userId !== userId) {
    throw new ConvexError("cover blob storage id does not belong to caller");
  }
}

// PLAN_010: best-effort cleanup helper used when delete-after-patch fires.
// Storage delete is non-transactional; a transient failure must not roll
// back the patch we already committed. The cron sweep is the safety net.
async function safeDeleteStorage(
  ctx: MutationCtx,
  storageId: Id<"_storage"> | undefined,
): Promise<void> {
  if (!storageId) return;
  try {
    await ctx.storage.delete(storageId);
  } catch (err) {
    // Surface the failure in Convex function logs so a systematic backend
    // regression (auth change, API shape drift) is visible — the cron
    // sweep still owns recovery, but silent failures defeat observability.
    console.error("[safeDeleteStorage] ctx.storage.delete failed", storageId, err);
  }
}

export const create = authMutation({
  args: {
    title: v.string(),
    slug: v.optional(v.string()),
    category: v.string(),
    body: v.any(),
    status: v.union(v.literal("draft"), v.literal("published")),
    coverImageStorageId: v.optional(v.id("_storage")),
    coverImageThumbhash: v.optional(v.string()),
    // PLAN_010: optional MP4 cover. The poster is mandatory whenever the
    // video is set so `<video poster>` has a frame to show before
    // metadata loads. Image and video are mutually exclusive — supplying
    // both is rejected at the mutation boundary.
    coverVideoStorageId: v.optional(v.id("_storage")),
    coverVideoPosterStorageId: v.optional(v.id("_storage")),
  },
  returns: v.id("articles"),
  handler: async (ctx, args) => {
    const appUser = await getAppUser(ctx, ctx.user._id);

    validateContentStringLength(args.title, "Title", MAX_TITLE_LENGTH);
    validateContentStringLength(args.category, "Category", MAX_CATEGORY_LENGTH);
    if (args.coverImageThumbhash !== undefined) {
      validateThumbhashFormat(args.coverImageThumbhash);
    }

    // PLAN_010: image and video covers are mutually exclusive. Either OR
    // (neither is fine — covers are optional). Reject upstream so the
    // schema invariant "at most one cover kind set per row" can be relied
    // on by the render-precedence rule.
    if (
      args.coverImageStorageId !== undefined &&
      args.coverVideoStorageId !== undefined
    ) {
      throw new ConvexError(
        "cover image and cover video are mutually exclusive — supply at most one",
      );
    }
    // Video without poster is invalid: the render path needs both.
    if (
      args.coverVideoStorageId !== undefined &&
      args.coverVideoPosterStorageId === undefined
    ) {
      throw new ConvexError(
        "cover video requires a sibling poster storage id",
      );
    }
    // Poster without a video is invalid: the field has no rendering
    // meaning on its own and would just leak a blob into _storage.
    if (
      args.coverVideoPosterStorageId !== undefined &&
      args.coverVideoStorageId === undefined
    ) {
      throw new ConvexError(
        "cover video poster requires a sibling cover video storage id",
      );
    }

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

    // FG_148: Reject bodies with external image src URLs (no storageId set).
    // Editor-authored bodies always set storageId for inserted images; this
    // guard catches direct mutation calls with attacker-controlled URLs.
    // The markdown-import flow bypasses this check (it uses a separate path
    // via importMarkdownInlineImages / importArticleMarkdownInlineImages).
    if (hasExternalImageSrcs(args.body)) {
      throw new ConvexError(
        "body contains image nodes with external src URLs; use the storage upload flow",
      );
    }

    // FG_147 / PLAN_010: Verify every cover blob belongs to the calling
    // user before writing. Each blob (image, video, video poster) has its
    // own ownership row in `coverImageOwnership`.
    if (args.coverImageStorageId !== undefined) {
      await assertCoverBlobOwnership(
        ctx,
        args.coverImageStorageId,
        appUser._id,
      );
    }
    if (args.coverVideoStorageId !== undefined) {
      await assertCoverBlobOwnership(
        ctx,
        args.coverVideoStorageId,
        appUser._id,
      );
    }
    if (args.coverVideoPosterStorageId !== undefined) {
      await assertCoverBlobOwnership(
        ctx,
        args.coverVideoPosterStorageId,
        appUser._id,
      );
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
      coverImageThumbhash: args.coverImageThumbhash,
      coverVideoStorageId: args.coverVideoStorageId,
      coverVideoPosterStorageId: args.coverVideoPosterStorageId,
      createdAt: now,
      publishedAt: args.status === "published" ? now : undefined,
    });

    // FG_091: claim ownership for every inline-image storageId committed in
    // this body. First-commit-wins — if another user already claimed the
    // storageId (by uploading and committing it earlier), this is a no-op,
    // which is exactly what we want: copying a storageId from someone
    // else's body must NOT transfer ownership.
    await claimInlineImageOwnership(ctx, args.body, appUser._id);

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
    coverImageThumbhash: v.optional(v.string()),
    // PLAN_010: optional MP4 cover. Supplying `coverVideoStorageId`
    // requires `coverVideoPosterStorageId` to also be set, and clears
    // any existing image cover (mutual exclusion). Conversely, supplying
    // a new `coverImageStorageId` clears the video + poster.
    coverVideoStorageId: v.optional(v.id("_storage")),
    coverVideoPosterStorageId: v.optional(v.id("_storage")),
    // Explicit removal signal for the cover. The schema fields stay
    // `v.optional(v.id("_storage"))`; setting `clearCoverImage: true`
    // makes the handler patch every cover field to `undefined` which
    // Convex interprets as "remove these optional fields". Without this
    // sentinel there is no way to distinguish "user cleared the cover"
    // from "user didn't touch the cover" — both arrive as `undefined`
    // after the optional-arg validator runs. The arg name predates
    // PLAN_010; it now clears image + video + poster (the entire cover
    // surface) so a single Remove button maps to a single mutation arg.
    clearCoverImage: v.optional(v.boolean()),
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

    // FG_148: Reject bodies with external image src URLs (no storageId set).
    // Same guard as in `create`; the markdown-import path bypasses this.
    if (args.body !== undefined && hasExternalImageSrcs(args.body)) {
      throw new ConvexError(
        "body contains image nodes with external src URLs; use the storage upload flow",
      );
    }

    // PLAN_010: image and video covers are mutually exclusive on update
    // too. The caller must commit to one cover kind per call; the
    // delete-old-blobs path below relies on the invariant "after this
    // patch, the row has at most one cover kind".
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
      throw new ConvexError(
        "cover video requires a sibling poster storage id",
      );
    }
    if (
      args.coverVideoPosterStorageId !== undefined &&
      args.coverVideoStorageId === undefined
    ) {
      throw new ConvexError(
        "cover video poster requires a sibling cover video storage id",
      );
    }

    // FG_147 / PLAN_010: Verify every cover blob the caller is committing
    // belongs to them.
    if (args.coverImageStorageId !== undefined) {
      await assertCoverBlobOwnership(
        ctx,
        args.coverImageStorageId,
        appUser._id,
      );
    }
    if (args.coverVideoStorageId !== undefined) {
      await assertCoverBlobOwnership(
        ctx,
        args.coverVideoStorageId,
        appUser._id,
      );
    }
    if (args.coverVideoPosterStorageId !== undefined) {
      await assertCoverBlobOwnership(
        ctx,
        args.coverVideoPosterStorageId,
        appUser._id,
      );
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
    // Cover patch coupling (PLAN_010 D1).
    //
    // The row carries two parallel cover surfaces: image (storageId +
    // thumbhash) and video (storageId + poster). They are mutually
    // exclusive at the row level — the patch always clears the
    // not-chosen surface so a future read can rely on "video wins iff
    // coverVideoStorageId is set, else image".
    //
    // Image storage id and its thumbhash MUST move together so a stale
    // hash never describes a different image. The image branch never
    // carries over the prior hash on a swap — if the caller didn't
    // supply one, we write `undefined` instead.
    //
    // Branches:
    //   1. Explicit clear — `clearCoverImage: true` wipes every cover
    //      field. Takes precedence over any cover-* arg the caller also
    //      sent.
    //   2. New video cover — `coverVideoStorageId` differs from the
    //      stored value. Set video + poster, clear image fields.
    //   3. New image cover — `coverImageStorageId` differs from the
    //      stored value. Set image + thumbhash, clear video fields.
    //   4. Image hash-only patch — image storageId unchanged but the
    //      caller supplied a freshly computed hash (retry after a prior
    //      thumbhash-compute failure).
    //   5. Round-trip no-op — caller sent back the exact same ids.
    //      Preserves the editor pattern of round-tripping current values
    //      on every save.
    let replacedImage = false;
    let replacedVideo = false;
    let replacedPoster = false;
    let clearedAllCover = false;

    if (args.clearCoverImage === true) {
      patch.coverImageStorageId = undefined;
      patch.coverImageThumbhash = undefined;
      patch.coverVideoStorageId = undefined;
      patch.coverVideoPosterStorageId = undefined;
      clearedAllCover = true;
    } else if (
      args.coverVideoStorageId !== undefined &&
      args.coverVideoStorageId !== article.coverVideoStorageId
    ) {
      // Branch 2: new video cover (poster validated above).
      patch.coverVideoStorageId = args.coverVideoStorageId;
      patch.coverVideoPosterStorageId = args.coverVideoPosterStorageId;
      patch.coverImageStorageId = undefined;
      patch.coverImageThumbhash = undefined;
      replacedVideo = true;
      replacedPoster =
        args.coverVideoPosterStorageId !== article.coverVideoPosterStorageId;
    } else if (
      args.coverImageStorageId !== undefined &&
      args.coverImageStorageId !== article.coverImageStorageId
    ) {
      patch.coverImageStorageId = args.coverImageStorageId;
      patch.coverImageThumbhash = args.coverImageThumbhash;
      patch.coverVideoStorageId = undefined;
      patch.coverVideoPosterStorageId = undefined;
      replacedImage = true;
    } else if (args.coverImageThumbhash !== undefined) {
      patch.coverImageThumbhash = args.coverImageThumbhash;
    }
    // Branch 5: round-trip no-op — no patch fields written.

    if (args.status !== undefined) {
      patch.status = args.status;
      if (args.status === "published" && !article.publishedAt) {
        patch.publishedAt = Date.now();
      }
    }

    await ctx.db.patch(args.id, patch);

    // After the patch succeeds, cascade-delete blobs that the patch made
    // unreferenced. `ctx.storage.delete` is not transactional — a
    // failure here must not roll back the patch we already committed,
    // so each delete is guarded and the cron sweep is the safety net.
    //
    // The branches mirror the patch branches above:
    //   - Branch 1 (clearAllCover): delete every previously-stored
    //     cover blob (image, video, poster).
    //   - Branch 2 (replacedVideo): delete the prior video blob, the
    //     prior poster (if it changed too), AND the prior image blob —
    //     swapping kinds vacates the other surface.
    //   - Branch 3 (replacedImage): delete the prior image blob AND the
    //     prior video + poster if they were set.
    if (clearedAllCover || replacedVideo || replacedImage) {
      // Image and video share the same trigger condition for deletion
      // — clearing or replacing either kind vacates the other surface.
      // safeDeleteStorage guards undefined so the inner checks could be
      // dropped, but they keep intent clear.
      if (article.coverImageStorageId) {
        await safeDeleteStorage(ctx, article.coverImageStorageId);
      }
      if (article.coverVideoStorageId) {
        await safeDeleteStorage(ctx, article.coverVideoStorageId);
      }
    }
    if (clearedAllCover || replacedImage || replacedPoster) {
      if (article.coverVideoPosterStorageId) {
        await safeDeleteStorage(ctx, article.coverVideoPosterStorageId);
      }
    }

    // FG_091: claim ownership for any new inline-image storageIds in the
    // committed body. Existing claims are left untouched (first-commit
    // wins).
    if (args.body !== undefined) {
      await claimInlineImageOwnership(ctx, args.body, appUser._id);
    }

    // After the patch succeeds, delete inline storage IDs that are no longer
    // referenced. FG_091: filter to IDs the ownership table attributes to
    // the current caller — refuses to delete blobs introduced by another
    // user (the cross-user storage-deletion attack). Legacy IDs (no
    // ownership row) are silently skipped; the cron sweep is the safety
    // net for those.
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

      // Delete covers after the row is gone so a failed delete can't leave a
      // live article pointing at a missing asset. Best-effort: a missing or
      // transient blob must not abort the whole removal — the cron sweep
      // collects any survivors. PLAN_010: an article carries at most one
      // cover kind at any time, but legacy rows or write races could in
      // principle have both — clean up whichever fields are populated.
      await safeDeleteStorage(ctx, article.coverImageStorageId);
      await safeDeleteStorage(ctx, article.coverVideoStorageId);
      await safeDeleteStorage(ctx, article.coverVideoPosterStorageId);

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

// FG_147: After a cover image upload completes, the client calls this mutation
// to record ownership. The client provides the storageId returned by Convex
// after the HTTP upload (via the upload URL). This is the trust boundary:
// userId is always derived server-side from `getAppUser` — never from args.
//
// Args validator MUST NOT include a `userId` field. See `.claude/rules/embeddings.md`.
export const claimCoverImageOwnership = authMutation({
  args: {
    storageId: v.id("_storage"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const appUser = await getAppUser(ctx, ctx.user._id);

    // First-claim-wins: if another user already claimed this storageId, leave
    // the existing row intact (mirrors inlineImageOwnership behavior).
    const existing = await ctx.db
      .query("coverImageOwnership")
      .withIndex("by_storageId", (q) => q.eq("storageId", args.storageId))
      .unique();
    if (existing) return null;

    await ctx.db.insert("coverImageOwnership", {
      storageId: args.storageId,
      userId: appUser._id,
      createdAt: Date.now(),
    });
    return null;
  },
});

// PLAN_010: presigned upload URL for an MP4 cover video. Thin wrapper
// over `ctx.storage.generateUploadUrl()` — kept as a separate mutation
// from the cover-image and poster URL generators so the client can
// request both video and poster URLs in parallel and so each
// orphan-cleanup path stays symmetric.
export const generateArticleCoverVideoUploadUrl = authMutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

// PLAN_010: presigned upload URL for the auto-extracted JPEG poster
// (the still frame the client grabs from the chosen MP4 at ~0.1s).
export const generateArticleCoverVideoPosterUploadUrl = authMutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

// PLAN_010: After the MP4 upload completes the client calls this
// mutation to record ownership AND server-side validate the blob's
// MIME + size against the cover-video policy. Convex provides no hook
// to reject by Content-Length on the upload URL itself — this is the
// defense-in-depth shape inline-image ownership already uses.
//
// On reject we delete the over-cap / wrong-MIME blob immediately so a
// rejected upload doesn't sit in `_storage` waiting for the cron sweep.
//
// Args validator MUST NOT include a `userId` field. See `.claude/rules/embeddings.md`.
export const claimCoverVideoOwnership = authMutation({
  args: {
    storageId: v.id("_storage"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const appUser = await getAppUser(ctx, ctx.user._id);

    const meta = await ctx.db.system.get(args.storageId);
    if (!meta) {
      throw new ConvexError("cover video blob not found in storage");
    }
    const contentType = meta.contentType ?? "";
    if (!ALLOWED_COVER_VIDEO_TYPES.has(contentType)) {
      // Best-effort cleanup; the cron sweep is the safety net.
      await safeDeleteStorage(ctx, args.storageId);
      throw new ConvexError(
        `cover video must be one of ${[...ALLOWED_COVER_VIDEO_TYPES].join(", ")}; got "${contentType}"`,
      );
    }
    if (meta.size > MAX_COVER_VIDEO_BYTES) {
      await safeDeleteStorage(ctx, args.storageId);
      throw new ConvexError(
        `cover video exceeds maximum size of ${MAX_COVER_VIDEO_BYTES} bytes (got ${meta.size})`,
      );
    }

    // First-claim-wins.
    const existing = await ctx.db
      .query("coverImageOwnership")
      .withIndex("by_storageId", (q) => q.eq("storageId", args.storageId))
      .unique();
    if (existing) return null;

    await ctx.db.insert("coverImageOwnership", {
      storageId: args.storageId,
      userId: appUser._id,
      createdAt: Date.now(),
    });
    return null;
  },
});

// PLAN_010: claim ownership for the JPEG poster the client extracts
// from the MP4. The poster is an image, so we validate against the
// inline-image MIME+size policy (it's auto-encoded by the browser at
// quality 0.85 from a single frame and is comfortably under the
// 5 MiB cap in practice).
export const claimCoverVideoPosterOwnership = authMutation({
  args: {
    storageId: v.id("_storage"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const appUser = await getAppUser(ctx, ctx.user._id);

    const meta = await ctx.db.system.get(args.storageId);
    if (!meta) {
      throw new ConvexError("cover video poster blob not found in storage");
    }
    const contentType = meta.contentType ?? "";
    if (!contentType.startsWith("image/")) {
      await safeDeleteStorage(ctx, args.storageId);
      throw new ConvexError(
        `cover video poster must be an image; got "${contentType}"`,
      );
    }
    if (meta.size > MAX_INLINE_IMAGE_BYTES) {
      await safeDeleteStorage(ctx, args.storageId);
      throw new ConvexError(
        `cover video poster exceeds maximum size of ${MAX_INLINE_IMAGE_BYTES} bytes (got ${meta.size})`,
      );
    }

    const existing = await ctx.db
      .query("coverImageOwnership")
      .withIndex("by_storageId", (q) => q.eq("storageId", args.storageId))
      .unique();
    if (existing) return null;

    await ctx.db.insert("coverImageOwnership", {
      storageId: args.storageId,
      userId: appUser._id,
      createdAt: Date.now(),
    });
    return null;
  },
});

// FG_129: Eagerly clean up a cover-image storage blob that was uploaded
// before a `create` call that subsequently failed (e.g. slug collision).
//
// Trust boundary: verifies that NO `articles` row references the storageId
// before deleting. This scan and the delete execute inside the same mutation
// transaction so there is no TOCTOU window between the reference check and
// `ctx.storage.delete`. The mutation does not accept a userId arg — ownership
// is derived server-side from `getAppUser`.
//
// Failure modes:
//   - If the blog row was somehow created in a concurrent request before this
//     mutation runs, the scan finds it and aborts — blob is preserved.
//   - If the blob is already gone (double-call), `ctx.storage.delete` is a
//     no-op (Convex storage treats missing-blob deletes as idempotent).
export const deleteOrphanCoverImage = authMutation({
  args: {
    storageId: v.id("_storage"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Verify that no articles row references this storageId. Scan the full
    // table (no index on coverImageStorageId) — this is a compensating delete
    // on an error path, not a hot path.
    const referencingArticle = await ctx.db
      .query("articles")
      .filter((q) => q.eq(q.field("coverImageStorageId"), args.storageId))
      .first();

    if (referencingArticle !== null) {
      // A row was successfully created (or another article already claimed
      // this blob). Do NOT delete.
      return null;
    }

    try {
      await ctx.storage.delete(args.storageId);
    } catch {
      // Blob may already be gone (double-call) or invalid — safe to ignore.
    }

    return null;
  },
});

// PLAN_010: Eagerly clean up the video + poster blobs uploaded before
// a `create` that subsequently failed (e.g. slug collision). Mirrors
// `deleteOrphanCoverImage`. Two table scans because the video and the
// poster are stored in two separate fields — both must be checked
// before deleting either blob, otherwise a concurrent `create` that
// committed only one of them would race the orphan delete.
//
// Trust boundary: TOCTOU-safe — the reference scan and the delete run
// inside the same mutation transaction.
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

    if (args.videoStorageId !== undefined) {
      const referencingVideo = await ctx.db
        .query("articles")
        .filter((q) =>
          q.eq(q.field("coverVideoStorageId"), args.videoStorageId),
        )
        .first();
      if (referencingVideo === null) {
        await safeDeleteStorage(ctx, args.videoStorageId);
      }
    }

    if (args.posterStorageId !== undefined) {
      const referencingPoster = await ctx.db
        .query("articles")
        .filter((q) =>
          q.eq(q.field("coverVideoPosterStorageId"), args.posterStorageId),
        )
        .first();
      if (referencingPoster === null) {
        await safeDeleteStorage(ctx, args.posterStorageId);
      }
    }

    return null;
  },
});

// Backfill mutation: refuses to patch when the article's current
// `coverImageStorageId` no longer matches `expectedStorageId`, guarding the
// race where a user replaces the cover between the URL fetch + encode and
// this patch. See `scripts/backfill-cover-thumbhash.ts`.
export const setCoverImageThumbhash = internalMutation({
  args: {
    id: v.id("articles"),
    expectedStorageId: v.id("_storage"),
    thumbhash: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    validateThumbhashFormat(args.thumbhash);
    const article = await ctx.db.get(args.id);
    if (!article) throw new Error("Article not found");
    if (article.coverImageStorageId === undefined) {
      throw new Error("Article has no cover image to hash");
    }
    if (article.coverImageStorageId !== args.expectedStorageId) {
      throw new Error(
        "Cover image changed during backfill — skipping stale hash",
      );
    }
    await ctx.db.patch(args.id, { coverImageThumbhash: args.thumbhash });
    return null;
  },
});
