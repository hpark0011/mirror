import { v } from "convex/values";
import { action, internalMutation } from "../_generated/server";
import { authMutation } from "../lib/auth";
import { getAppUser } from "../users/helpers";
import { validateThumbhashFormat } from "./helpers";
import { collectReferencedFromCandidates } from "../content/storageRegistry";
import {
  claimCoverBlobOwnershipFromAction,
  deleteCoverBlobAndOwnership,
  filterCallerOwnedCoverBlobIds,
} from "../content/coverBlobOwnership";
import {
  ALLOWED_INLINE_IMAGE_TYPES,
  ALLOWED_COVER_VIDEO_TYPES,
  MAX_COVER_VIDEO_BYTES,
  MAX_INLINE_IMAGE_BYTES,
} from "../content/storagePolicy";
import {
  createArticleForUser,
  deleteArticleForUserById,
  updateArticleForUserById,
} from "./writeHelpers";

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
    return (await createArticleForUser(ctx, appUser._id, args)).id;
  },
});

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
    // Explicit removal signal for the whole cover surface. Optional
    // storage args cannot distinguish "user cleared the cover" from
    // "user did not touch the cover" once validation has run.
    clearCover: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const appUser = await getAppUser(ctx, ctx.user._id);
    const { id, ...rest } = args;
    await updateArticleForUserById(ctx, appUser._id, id, rest);
    return null;
  },
});

export const remove = authMutation({
  args: { ids: v.array(v.id("articles")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const appUser = await getAppUser(ctx, ctx.user._id);
    const uniqueIds = [...new Set(args.ids)];
    for (const id of uniqueIds) {
      await deleteArticleForUserById(ctx, appUser._id, id);
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

// FG_147: After a cover image upload completes, the client calls this action
// to record ownership. The client provides the storageId returned by Convex
// after the HTTP upload (via the upload URL). This is the trust boundary:
// userId is always derived server-side from `getAppUser` — never from args.
//
// Args validator MUST NOT include a `userId` field. See `.claude/rules/embeddings.md`.
export const claimCoverImageOwnership = action({
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

export const generateArticleCoverVideoUploadUrls = authMutation({
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

// PLAN_010: After the MP4 upload completes the client calls this
// action to record ownership AND server-side validate the blob's MIME +
// size against the cover-video policy. Convex provides no hook to reject
// by Content-Length on the upload URL itself — this is the defense-in-depth
// shape inline-image ownership already uses.
//
// On reject we delete the over-cap / wrong-MIME blob inside this action
// before throwing. A mutation cannot safely do "delete then throw" because
// Convex rolls the storage delete back with the failed transaction.
//
// Args validator MUST NOT include a `userId` field. See `.claude/rules/embeddings.md`.
export const claimCoverVideoOwnership = action({
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

// PLAN_010: claim ownership for the JPEG poster the client extracts
// from the MP4. The poster is an image, so we validate against the
// inline-image MIME+size policy (it's auto-encoded by the browser at
// quality 0.85 from a single frame and is comfortably under the
// 5 MiB cap in practice).
export const claimCoverVideoPosterOwnership = action({
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
//
// Trust boundary: verifies the caller owns the cover blob, then checks the
// canonical storage registry for live references before deleting. The mutation
// does not accept a userId arg — ownership is derived server-side from
// `getAppUser`.
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

// PLAN_010: Eagerly clean up the video + poster blobs uploaded before
// a `create` that subsequently failed (e.g. slug collision). Mirrors
// `deleteOrphanCoverImage`: ownership is checked first, then the storage
// registry decides whether any live row still references each candidate.
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
