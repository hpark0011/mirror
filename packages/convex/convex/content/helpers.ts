import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { authComponent } from "../auth/client";
export { MAX_SLUG_LENGTH, MAX_TITLE_LENGTH } from "./schema";

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

export function generateSlug(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!slug) {
    throw new Error("Cannot generate slug from the given title");
  }

  return slug;
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
