---
id: FG_168
title: "Partial claim failure leaves dangling coverImageOwnership row pointing at deleted blob"
date: 2026-05-08
type: fix
status: completed
priority: p1
description: "When claimCoverVideoOwnership rejects but claimCoverVideoPosterOwnership succeeds (or vice versa) under Promise.all, the surviving claim mutation's ownership row stays in the table after the orphan-cleanup mutation deletes the blob, breaking the invariant that every coverImageOwnership row points at a live blob."
dependencies: ["FG_179"]
parent_plan_id: PLAN_010
acceptance_criteria:
  - "`grep -n 'ctx.db.delete' packages/convex/convex/articles/mutations.ts` shows a `coverImageOwnership` row delete inside deleteOrphanCoverVideo (and deleteOrphanCoverImage) after each `safeDeleteStorage`"
  - "A convex-test case simulates partial claim failure: one ownership row exists for blob X, deleteOrphanCoverVideo({videoStorageId: X}) is called, asserts BOTH the blob is gone AND the coverImageOwnership row is gone"
  - "`pnpm --filter=@feel-good/convex test` passes"
  - "`pnpm --filter=@feel-good/mirror lint` exits 0"
owner_agent: "Convex Backend Engineer"
---

# Partial Claim Failure Leaves Dangling coverImageOwnership Row Pointing at Deleted Blob

## Context

`useArticleCoverVideoUpload` claims video and poster ownership in parallel via `Promise.all`. If `claimCoverVideoOwnership` rejects (over-25-MiB blob — line 718 of mutations.ts deletes the blob and throws), `claimCoverVideoPosterOwnership` may have already committed its ownership row. The catch in the hook fires `deleteOrphanCoverVideo({ videoStorageId, posterStorageId })`.

`deleteOrphanCoverVideo` (`mutations.ts:846-886`) deletes the blobs but never deletes the corresponding `coverImageOwnership` rows. Result: the poster's ownership row survives indefinitely with `storageId` pointing at a blob that no longer exists. The orphan-sweep cron does NOT scan `coverImageOwnership` (it's explicitly excluded — see `orphanSweep.test.ts:524`).

The same gap applies to every cleanup path: `articles.update` cascade delete, `articles.remove` cascade delete, and both orphan-cleanup mutations all delete blobs without cleaning up ownership rows. FG_179 captures the broader table-growth issue; this ticket focuses on the immediate consistency violation in the orphan-cleanup path.

- **Source:** Code review of PLAN_010 article-cover-video branch
- **Location:** `apps/mirror/features/articles/hooks/use-article-cover-video-upload.ts:187-198` (caller) and `packages/convex/convex/articles/mutations.ts:846-886` (mutation)
- **Evidence:** No `ctx.db.delete` against `coverImageOwnership` exists anywhere in the convex backend.

## Goal

Every successful blob deletion in `deleteOrphanCoverVideo` and `deleteOrphanCoverImage` is paired with the corresponding `coverImageOwnership` row delete, restoring the invariant "every ownership row references a live blob."

## Scope

- Add `coverImageOwnership` row deletion to both orphan-cleanup mutations after each `safeDeleteStorage` call.
- Cover the partial-claim-failure scenario with a convex-test case.

## Out of Scope

- Cleaning up ownership rows during `articles.update` cascade-delete and `articles.remove` (FG_179).
- Adding a `kind` discriminator to the table (FG_196).
- Fixing the upstream Promise.all race (FG_169).

## Approach

After each `safeDeleteStorage` in `deleteOrphanCoverVideo`, query `coverImageOwnership` by `by_storageId` and `ctx.db.delete` the row if present. The query is bounded (single row by unique index) and is part of the same mutation transaction as the blob delete. Apply the same pattern to `deleteOrphanCoverImage`.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. In `packages/convex/convex/articles/mutations.ts`, after each `safeDeleteStorage(ctx, args.videoStorageId)` and `safeDeleteStorage(ctx, args.posterStorageId)` inside `deleteOrphanCoverVideo`, add `const ownerRow = await ctx.db.query("coverImageOwnership").withIndex("by_storageId", (q) => q.eq("storageId", id)).unique(); if (ownerRow) await ctx.db.delete(ownerRow._id);`.
2. Apply the same pattern to `deleteOrphanCoverImage`.
3. Add a convex-test case that seeds a `coverImageOwnership` row, calls the orphan-delete mutation, asserts both the blob is gone AND the ownership row is gone.
4. Update the existing `deleteOrphanCoverVideo` test (`mutations.test.ts:858-903`) to also assert ownership-row state (covers FG_200).
5. Run `pnpm --filter=@feel-good/convex test`.

## Constraints

- The blob delete and ownership-row delete run in the same transaction — if the ownership-row delete throws, the blob delete is rolled back. Wrap each row delete in try/catch only if Convex semantics require it; otherwise let the transaction guarantee atomicity.
- This change must be coordinated with FG_167 (caller-ownership check) — FG_167 lands first to gate who can call the mutation, then this ticket lands the consistency cleanup.

## Resources

- Existing pattern: `inlineImageOwnership` cleanup elsewhere in the codebase — confirm the same shape applies here.
- FG_179 — the broader unbounded-growth issue this ticket partially mitigates.
