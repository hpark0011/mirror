import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { authComponent } from "../auth/client";
export { MAX_SLUG_LENGTH, MAX_TITLE_LENGTH } from "./schema";

export async function resolveStorageUrl(
  ctx: QueryCtx | MutationCtx,
  storageId: Id<"_storage"> | undefined,
): Promise<string | null> {
  if (!storageId) {
    return null;
  }
  return await ctx.storage.getUrl(storageId);
}

export function validateContentStringLength(
  value: string,
  field: string,
  maxLength: number,
): void {
  if (value.length > maxLength) {
    throw new Error(
      `${field} exceeds maximum length of ${maxLength} (got ${value.length})`,
    );
  }
}

export async function getUserAndContentAccess(
  ctx: QueryCtx,
  username: string,
): Promise<{ user: Doc<"users">; isOwner: boolean } | null> {
  const user = await ctx.db
    .query("users")
    .withIndex("by_username", (q) => q.eq("username", username))
    .unique();
  if (!user) {
    return null;
  }

  const authUser = await authComponent.safeGetAuthUser(ctx);
  const isOwner = !!authUser && user.authId === authUser._id;

  return { user, isOwner };
}

export function filterVisibleContent<T extends { status: "draft" | "published" }>(
  content: T[],
  isOwner: boolean,
) {
  return content.filter((entry) => isOwner || entry.status !== "draft");
}

export function isOwnedByUser(
  record: { userId: Id<"users"> },
  userId: Id<"users">,
) {
  return record.userId === userId;
}
