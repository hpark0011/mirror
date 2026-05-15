import { v } from "convex/values";
import { action } from "../_generated/server";
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
  MAX_INLINE_IMAGE_BYTES,
} from "../content/storagePolicy";
import {
  createProjectForUser,
  removeProjectForUser,
  updateProjectForUser,
} from "./writeHelpers";

export const create = authMutation({
  args: {
    title: v.string(),
    startDate: v.number(),
    endDate: v.union(v.number(), v.null()),
    description: v.optional(v.string()),
    link: v.optional(v.string()),
    coverImageStorageId: v.optional(v.id("_storage")),
    coverImageThumbhash: v.optional(v.string()),
  },
  returns: v.id("projects"),
  handler: async (ctx, args) => {
    const appUser = await getAppUser(ctx, ctx.user._id);
    return await createProjectForUser(ctx, appUser._id, args);
  },
});

export const update = authMutation({
  args: {
    id: v.id("projects"),
    title: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.union(v.number(), v.null())),
    description: v.optional(v.string()),
    link: v.optional(v.string()),
    coverImageStorageId: v.optional(v.id("_storage")),
    coverImageThumbhash: v.optional(v.string()),
    clearCover: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const appUser = await getAppUser(ctx, ctx.user._id);
    await updateProjectForUser(ctx, appUser._id, args);
    return null;
  },
});

export const remove = authMutation({
  args: {
    id: v.id("projects"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const appUser = await getAppUser(ctx, ctx.user._id);
    await removeProjectForUser(ctx, appUser._id, args.id);
    return null;
  },
});

export const generateProjectCoverImageUploadUrl = authMutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const claimProjectCoverImageOwnership = action({
  args: {
    storageId: v.id("_storage"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    return await claimCoverBlobOwnershipFromAction(ctx, args, {
      kind: "image",
      label: "project cover image",
      allowedTypes: ALLOWED_INLINE_IMAGE_TYPES,
      maxBytes: MAX_INLINE_IMAGE_BYTES,
    });
  },
});

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
