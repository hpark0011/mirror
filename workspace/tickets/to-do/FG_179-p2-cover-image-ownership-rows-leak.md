---
id: FG_179
title: "coverImageOwnership rows are never deleted — table grows monotonically"
date: 2026-05-08
type: fix
status: to-do
priority: p2
description: "No code path anywhere deletes rows from coverImageOwnership. The orphan-sweep cron explicitly excludes the table. Replace, remove, and orphan-cleanup all leave ownership rows behind. Over time the by_storageId index grows unbounded with rows pointing at non-existent blobs."
dependencies: ["FG_168"]
parent_plan_id: PLAN_010
acceptance_criteria:
  - "`grep -rn 'ctx.db.delete' packages/convex/convex/articles/mutations.ts` shows ownership-row deletes after each safeDeleteStorage in articles.update cascade-delete, articles.remove, deleteOrphanCoverVideo, and deleteOrphanCoverImage"
  - "A convex-test case for articles.remove asserts the coverImageOwnership row(s) for the deleted article's cover blobs are also removed"
  - "A convex-test case for articles.update video-replace asserts the prior video's coverImageOwnership row is removed"
  - "`pnpm --filter=@feel-good/convex test` passes"
owner_agent: "Convex Backend Engineer"
---

# coverImageOwnership Rows Are Never Deleted — Table Grows Monotonically

## Context

The `coverImageOwnership` table records who uploaded each cover blob (image, video, poster). Every claim mutation inserts a row. No code path anywhere deletes rows.

Confirmed by `grep -rn 'ctx.db.delete' packages/convex/convex/`:
- `articles.remove` deletes the article row + storage blobs but NOT ownership rows
- `articles.update` cascade-delete (lines 481-498) deletes prior storage blobs but NOT ownership rows
- `deleteOrphanCoverVideo` and `deleteOrphanCoverImage` delete blobs but NOT ownership rows

The orphan-sweep cron explicitly excludes this table (`orphanSweep.test.ts:524`):
```ts
const INTENTIONAL_NON_SWEEP_FIELDS = new Set(["coverImageOwnership.storageId"]);
```

Over time the table accumulates rows pointing at storage ids that no longer exist. The `by_storageId` index grows unbounded. The invariant "every coverImageOwnership row references a live blob" breaks immediately on the first cover replace.

FG_168 covers the partial-claim-failure scenario in the orphan-cleanup mutations. This ticket extends the cleanup to every other write path.

- **Source:** Code review of PLAN_010 article-cover-video branch
- **Location:** `packages/convex/convex/articles/mutations.ts:481-498,584-594,704-791,807-887`
- **Evidence:** No ownership-row deletes anywhere; the cron explicitly skips this table.

## Goal

Every blob delete in the article mutations is paired with the corresponding ownership-row delete. The `coverImageOwnership` table size is proportional to live cover blobs, not to historical activity.

## Scope

- Add ownership-row cleanup to `articles.update`'s cascade-delete block.
- Add ownership-row cleanup to `articles.remove`.
- Add ownership-row cleanup to both orphan-cleanup mutations (covered by FG_168 — coordinate).
- Tests covering each path.

## Out of Scope

- Adding a `kind` discriminator to the table (FG_196).
- Backfilling existing stale ownership rows (separate migration ticket if real data shows accumulation).
- Renaming the table (FG_198).

## Approach

Add a small helper that takes a storage id and deletes the matching ownership row in the same transaction:

```ts
async function deleteCoverBlobOwnership(
  ctx: MutationCtx,
  storageId: Id<"_storage"> | undefined,
): Promise<void> {
  if (!storageId) return;
  const row = await ctx.db
    .query("coverImageOwnership")
    .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
    .unique();
  if (row) await ctx.db.delete(row._id);
}
```

Call alongside each `safeDeleteStorage` in:
- `articles.update` cascade-delete (lines 481-499)
- `articles.remove` cascade-delete (lines 592-594)
- `deleteOrphanCoverVideo` (FG_168 covers this)
- `deleteOrphanCoverImage` (FG_168 covers this)

Order: the ownership-row delete and the blob delete share the mutation transaction. If either fails, the transaction rolls back (Convex semantics) — no partial state.

- **Effort:** Medium
- **Risk:** Low

## Implementation Steps

1. Add the `deleteCoverBlobOwnership` helper at the top of `packages/convex/convex/articles/mutations.ts` near `safeDeleteStorage`.
2. In `articles.update` cascade-delete blocks (lines 481-499), call `deleteCoverBlobOwnership` after each `safeDeleteStorage`.
3. In `articles.remove` (lines 592-594), call `deleteCoverBlobOwnership` for each cover storage id alongside `safeDeleteStorage`.
4. Coordinate with FG_168 — share the helper between the orphan-cleanup mutations and the cascade-delete paths.
5. Add convex-test cases for each path (remove, update-video-replace, update-image-replace, update-clearAllCover) asserting the ownership row is gone after the mutation.
6. Run `pnpm --filter=@feel-good/convex test`.

## Constraints

- The blob delete and ownership-row delete must run in the same Convex mutation transaction so a partial failure does not leave inconsistent state.
- The `by_storageId` index already exists on `coverImageOwnership` — no schema change needed.
- This change is independent of FG_167 (caller-ownership check) — they layer.

## Resources

- Source: `packages/convex/convex/articles/mutations.ts:481-499,584-594`
- Schema: `packages/convex/convex/articles/schema.ts:58-66`
- Cron exclusion: `packages/convex/convex/content/__tests__/orphanSweep.test.ts:524`
