// Helpers for the `inlineImageOwnership` table.
//
// Two responsibilities, used as a pair:
//
// 1. `claimInlineImageOwnership(ctx, body, userId)` — called from each
//    write path that commits a body containing inline-image `storageId`s
//    (articles/posts `create`, `update`, and the markdown-import body
//    patch). For every storageId in the body that does NOT yet have an
//    ownership row, insert one attributing the blob to `userId`. This is
//    "claim on first commit" — if user A already claimed a storageId,
//    user B copying that storageId into their body does NOT change the
//    ownership row.
//
// 2. `filterCallerOwnedInlineIds(ctx, ids, userId)` — called from
//    `update` and `remove` BEFORE the `ctx.storage.delete` loop. Filters
//    `ids` down to the IDs the table attributes to `userId`. IDs without
//    an ownership row (legacy bodies that pre-date the table) are
//    silently skipped — the cron sweep is the safety net for blobs that
//    eventually become orphaned.
//
// The pair closes the cross-user storage-deletion attack documented in
// FG_091: user B can no longer cause `ctx.storage.delete(<user A's
// storageId>)` to fire by including A's storageId in B's body.

import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import {
  extractInlineImageStorageIds,
  type JSONContent,
} from "./bodyWalk";

/**
 * Insert an `inlineImageOwnership` row for every storageId in `body` that
 * does NOT already have one. Rows are keyed by `storageId` via the
 * `by_storageId` index; existing rows are left untouched (first-commit
 * wins). Idempotent: calling with the same body+user twice produces no
 * additional rows.
 */
export async function claimInlineImageOwnership(
  ctx: MutationCtx,
  body: JSONContent | null | undefined,
  userId: Id<"users">,
): Promise<void> {
  if (!body) return;
  const ids = extractInlineImageStorageIds(body);
  if (ids.length === 0) return;

  // Dedup so we don't issue redundant index lookups for the same storageId
  // when a body references it multiple times.
  const unique = Array.from(new Set(ids)) as Id<"_storage">[];

  const now = Date.now();
  for (const storageId of unique) {
    const existing = await ctx.db
      .query("inlineImageOwnership")
      .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
      .unique();
    if (existing) continue;
    await ctx.db.insert("inlineImageOwnership", {
      storageId,
      userId,
      createdAt: now,
    });
  }
}

/**
 * Return the subset of `ids` whose `inlineImageOwnership` row attributes
 * the blob to `userId`. IDs with no ownership row (legacy bodies) are
 * silently dropped from the returned set — the constraint in the ticket
 * is "tolerated rather than deleted". IDs owned by another user are also
 * dropped, which is the cross-user attack mitigation.
 */
export async function filterCallerOwnedInlineIds(
  ctx: MutationCtx,
  ids: Id<"_storage">[],
  userId: Id<"users">,
): Promise<Id<"_storage">[]> {
  if (ids.length === 0) return ids;
  const out: Id<"_storage">[] = [];
  for (const storageId of ids) {
    const row = await ctx.db
      .query("inlineImageOwnership")
      .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
      .unique();
    if (!row) continue; // legacy: no ownership row → skip silently
    if (row.userId !== userId) continue; // not the caller's blob → skip
    out.push(storageId);
  }
  return out;
}

/**
 * Return only IDs that are not referenced by any current storage-bearing
 * document. Call this AFTER the article/post row has been patched or deleted:
 * the scan intentionally reflects the committed state, so a blob copied into
 * another article/post (or reused as a cover/avatar) is preserved.
 */
export async function filterUnreferencedStorageIds(
  ctx: MutationCtx,
  ids: Id<"_storage">[],
): Promise<Id<"_storage">[]> {
  if (ids.length === 0) return ids;

  const candidates = new Set<string>(ids);
  const referenced = new Set<string>();

  const users = await ctx.db.query("users").collect();
  for (const user of users) {
    if (user.avatarStorageId && candidates.has(user.avatarStorageId)) {
      referenced.add(user.avatarStorageId);
    }
  }

  const articles = await ctx.db.query("articles").collect();
  for (const article of articles) {
    if (
      article.coverImageStorageId &&
      candidates.has(article.coverImageStorageId)
    ) {
      referenced.add(article.coverImageStorageId);
    }
    for (const id of extractInlineImageStorageIds(article.body)) {
      if (candidates.has(id)) referenced.add(id);
    }
  }

  const posts = await ctx.db.query("posts").collect();
  for (const post of posts) {
    if (post.coverImageStorageId && candidates.has(post.coverImageStorageId)) {
      referenced.add(post.coverImageStorageId);
    }
    for (const id of extractInlineImageStorageIds(post.body)) {
      if (candidates.has(id)) referenced.add(id);
    }
  }

  return ids.filter((id) => !referenced.has(id));
}
