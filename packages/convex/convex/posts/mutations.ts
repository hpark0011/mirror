import { v } from "convex/values";
import { action, internalMutation } from "../_generated/server";
import { authMutation } from "../lib/auth";
import { getAppUser } from "../users/helpers";
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
import { getPostCategoryForSlug } from "./categories";
import {
  createPostForUser,
  deletePostForUserById,
  deletePostForUserBySlug,
  updatePostForUserById,
} from "./writeHelpers";

export const create = authMutation({
  args: {
    title: v.optional(v.string()),
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
    return (await createPostForUser(ctx, appUser._id, args)).id;
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
    const { id, ...rest } = args;
    await updatePostForUserById(ctx, appUser._id, id, rest);
    return null;
  },
});

export const remove = authMutation({
  args: { ids: v.array(v.id("posts")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const appUser = await getAppUser(ctx, ctx.user._id);
    const uniqueIds = [...new Set(args.ids)];
    for (const id of uniqueIds) {
      await deletePostForUserById(ctx, appUser._id, id);
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
    return await deletePostForUserBySlug(ctx, args.userId, args.slug);
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
