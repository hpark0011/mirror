// Shared helpers for the cover-blob ownership lifecycle.
//
// The `coverImageOwnership` table is a cross-feature ownership ledger keyed by
// storageId; both articles and posts use it. The original implementation lived
// inline in `articles/mutations.ts` because articles were the only feature
// with image+video covers. With posts gaining image+video parity, the helpers
// were lifted here so both modules call into the same trust boundary.
//
// Trust-boundary rules (mirror `.claude/rules/embeddings.md`):
//
//   - The internal Convex functions registered in this file must NOT take a
//     `userId` arg from a public caller. They take `authId` (Better Auth's id)
//     and the action handler derives `userId` server-side via `getAppUser`.
//
//   - `claimCoverBlobOwnershipFromAction` validates MIME + size *before*
//     inserting the ownership row, then deletes the blob if validation fails.
//     Convex storage delete is non-transactional, so this validate-then-delete
//     dance lives in an action; a mutation cannot do it safely.

import { ConvexError, v } from "convex/values";
import { type Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import {
  internalMutation,
  internalQuery,
  type ActionCtx,
  type MutationCtx,
} from "../_generated/server";
import { authComponent } from "../auth/client";
import { getAppUser } from "../users/helpers";

export type CoverBlobKind = "image" | "video" | "poster";

export const coverBlobKindValidator = v.union(
  v.literal("image"),
  v.literal("video"),
  v.literal("poster"),
);

// FG_147 / PLAN_010: Verify that `storageId` belongs to `userId` via the
// `coverImageOwnership` table. Throws `ConvexError` if the row is missing
// or attributed to a different user/kind.
//
// Called from `create`/`update` in articles and posts before writing any
// cover-blob storage id (image, video, or video poster). Args validators for
// mutations that write a cover storage id MUST NOT include `userId` — it is
// always derived server-side from `getAppUser`.
//
// Legacy rows from before FG_196 have no `kind`; those are accepted only as
// image claims during the widen/backfill/narrow migration window.
export async function assertCoverBlobOwnership(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
  userId: Id<"users">,
  expectedKind: CoverBlobKind,
): Promise<void> {
  const row = await ctx.db
    .query("coverImageOwnership")
    .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
    .unique();
  if (!row || row.userId !== userId) {
    throw new ConvexError("cover blob storage id does not belong to caller");
  }
  if (row.kind !== expectedKind) {
    const isLegacyImageClaim =
      row.kind === undefined && expectedKind === "image";
    if (!isLegacyImageClaim) {
      const actualKind = row.kind ?? "legacy image";
      throw new ConvexError(
        `cover blob is ${actualKind}, cannot be used as ${expectedKind}`,
      );
    }
  }
}

export async function filterCallerOwnedCoverBlobIds(
  ctx: MutationCtx,
  ids: Id<"_storage">[],
  userId: Id<"users">,
): Promise<Id<"_storage">[]> {
  if (ids.length === 0) return ids;
  const out: Id<"_storage">[] = [];
  for (const storageId of ids) {
    const row = await ctx.db
      .query("coverImageOwnership")
      .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
      .unique();
    if (!row) continue;
    if (row.userId !== userId) continue;
    out.push(storageId);
  }
  return out;
}

// PLAN_010: best-effort cleanup helper used when delete-after-patch fires.
// Storage delete is non-transactional; a transient failure must not roll
// back the patch we already committed. The cron sweep is the safety net.
export async function safeDeleteStorage(
  ctx: MutationCtx,
  storageId: Id<"_storage"> | undefined,
): Promise<boolean> {
  if (!storageId) return false;
  try {
    await ctx.storage.delete(storageId);
    return true;
  } catch (err) {
    console.error(
      "[safeDeleteStorage] ctx.storage.delete failed",
      storageId,
      err,
    );
    return false;
  }
}

export async function safeDeleteActionStorage(
  ctx: ActionCtx,
  storageId: Id<"_storage">,
): Promise<void> {
  try {
    await ctx.storage.delete(storageId);
  } catch (err) {
    console.error(
      "[safeDeleteActionStorage] ctx.storage.delete failed",
      storageId,
      err,
    );
  }
}

export async function deleteCoverBlobOwnership(
  ctx: MutationCtx,
  storageId: Id<"_storage"> | undefined,
): Promise<void> {
  if (!storageId) return;
  const row = await ctx.db
    .query("coverImageOwnership")
    .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
    .unique();
  if (row) {
    await ctx.db.delete(row._id);
  }
}

export async function deleteCoverBlobAndOwnership(
  ctx: MutationCtx,
  storageId: Id<"_storage"> | undefined,
): Promise<void> {
  if (await safeDeleteStorage(ctx, storageId)) {
    await deleteCoverBlobOwnership(ctx, storageId);
  }
}

export const _coverBlobOwnershipExists = internalQuery({
  args: {
    storageId: v.id("_storage"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("coverImageOwnership")
      .withIndex("by_storageId", (q) => q.eq("storageId", args.storageId))
      .unique();
    return row !== null;
  },
});

export const _insertCoverBlobOwnership = internalMutation({
  args: {
    storageId: v.id("_storage"),
    authId: v.string(),
    kind: coverBlobKindValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("coverImageOwnership")
      .withIndex("by_storageId", (q) => q.eq("storageId", args.storageId))
      .unique();
    if (existing) return null;

    const appUser = await getAppUser(ctx, args.authId);
    await ctx.db.insert("coverImageOwnership", {
      storageId: args.storageId,
      userId: appUser._id,
      createdAt: Date.now(),
      kind: args.kind,
    });
    return null;
  },
});

export type CoverBlobPolicy = {
  kind: CoverBlobKind;
  label: string;
  allowedTypes: ReadonlySet<string>;
  maxBytes: number;
};

// PLAN_010: After an upload completes, the public action records ownership
// AND server-side validates the blob's MIME + size against the policy.
// Convex provides no hook to reject by Content-Length on the upload URL
// itself — this is the defense-in-depth shape inline-image ownership uses.
//
// On reject we delete the over-cap / wrong-MIME blob inside this action
// before throwing. A mutation cannot safely do "delete then throw" because
// Convex rolls the storage delete back with the failed transaction.
export async function claimCoverBlobOwnershipFromAction(
  ctx: ActionCtx,
  args: { storageId: Id<"_storage"> },
  policy: CoverBlobPolicy,
): Promise<null> {
  const authUser = await authComponent.getAuthUser(ctx);

  const existing = await ctx.runQuery(
    internal.content.coverBlobOwnership._coverBlobOwnershipExists,
    { storageId: args.storageId },
  );
  if (existing) return null;

  const blob = await ctx.storage.get(args.storageId);
  if (!blob) {
    throw new ConvexError(`${policy.label} blob not found in storage`);
  }

  const contentType = blob.type ?? "";
  if (!policy.allowedTypes.has(contentType)) {
    await safeDeleteActionStorage(ctx, args.storageId);
    throw new ConvexError(
      `${policy.label} must be one of ${[...policy.allowedTypes].join(", ")}; got "${contentType}"`,
    );
  }
  if (blob.size > policy.maxBytes) {
    await safeDeleteActionStorage(ctx, args.storageId);
    throw new ConvexError(
      `${policy.label} exceeds maximum size of ${policy.maxBytes} bytes (got ${blob.size})`,
    );
  }

  await ctx.runMutation(
    internal.content.coverBlobOwnership._insertCoverBlobOwnership,
    {
      storageId: args.storageId,
      authId: authUser._id as string,
      kind: policy.kind,
    },
  );
  return null;
}
