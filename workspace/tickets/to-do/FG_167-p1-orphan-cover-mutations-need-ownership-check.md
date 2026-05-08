---
id: FG_167
title: "deleteOrphanCoverVideo and deleteOrphanCoverImage must verify caller owns the blob"
date: 2026-05-08
type: fix
status: to-do
priority: p1
description: "Both orphan-cleanup mutations accept any storage id from args and only check the articles table for references. Authenticated users can delete other users' pending uploads if they obtain the storage id from the network panel during upload — a cross-user storage-deletion vector."
dependencies: []
parent_plan_id: PLAN_010
acceptance_criteria:
  - "`grep -n 'coverImageOwnership' packages/convex/convex/articles/mutations.ts` shows ownership lookups inside both deleteOrphanCoverVideo and deleteOrphanCoverImage that gate `safeDeleteStorage`"
  - "A new convex-test case in `packages/convex/convex/articles/__tests__/mutations.test.ts` simulates user A uploading + claiming a blob, user B calling deleteOrphanCoverVideo with that id — asserts the blob still exists in `_storage` after the call"
  - "Both mutation handlers derive `userId` exclusively from `getAppUser(ctx, ctx.user._id)` (no `userId` field in args)"
  - "`pnpm --filter=@feel-good/convex test` passes"
owner_agent: "Convex Backend Security Engineer"
---

# Orphan-Cover Mutations Must Verify Caller Owns the Blob

## Context

`deleteOrphanCoverVideo` (`packages/convex/convex/articles/mutations.ts:846-886`) and the pre-existing `deleteOrphanCoverImage` (lines 807-835) accept arbitrary storage ids from caller args. Each scans the `articles` table for references and, if none found, calls `safeDeleteStorage`. Neither performs any check against the `coverImageOwnership` table to confirm the caller uploaded the blob.

Storage ids are not publicly enumerable, but they are visible in the browser Network panel during the presigned-URL upload step and may appear in server logs. An authenticated attacker who learns Alice's storage id during her upload (before Alice's `articles.create` commits and registers the reference) can call `deleteOrphanCoverVideo({ videoStorageId: alicesId })` and the blob will be deleted because no `articles` row references it yet.

This violates the cross-user isolation invariant in `.claude/rules/embeddings.md`: "Every consumer that writes to contentEmbeddings MUST set userId from getAppUser … never from a client-supplied argument." The same principle applies to deletion: caller ownership must be verified server-side.

- **Source:** Code review of PLAN_010 article-cover-video branch
- **Location:** `packages/convex/convex/articles/mutations.ts:846-886` (video) and `:807-835` (image — pre-existing)
- **Evidence:** Neither handler queries `coverImageOwnership` before deleting.

## Goal

Both orphan-cleanup mutations refuse to delete blobs the calling user does not own. Cross-user deletion attacks via leaked storage ids are blocked at the mutation boundary.

## Scope

- Add `coverImageOwnership` lookup at the top of both `deleteOrphanCoverVideo` and `deleteOrphanCoverImage`.
- Reject the call (or skip the specific blob) when the ownership row's `userId` does not match the calling user.
- Add a convex-test case demonstrating user-B-cannot-delete-user-A's-blob.

## Out of Scope

- Renaming the `coverImageOwnership` table to reflect its multi-blob-kind use (tracked in FG_196).
- Fixing the absence of MIME validation in `claimCoverImageOwnership` (FG_182).
- Cleaning up stale `coverImageOwnership` rows (FG_179).

## Approach

Insert an ownership check at the top of each handler before any reference scan. If the ownership row is missing OR the `userId` doesn't match, return `null` without deleting. Skip rather than throw so a legitimate retry after a partial failure (where the ownership row was cleaned up first) does not error.

```ts
const appUser = await getAppUser(ctx, ctx.user._id);
const ownerRow = await ctx.db
  .query("coverImageOwnership")
  .withIndex("by_storageId", (q) => q.eq("storageId", args.videoStorageId))
  .unique();
if (!ownerRow || ownerRow.userId !== appUser._id) return null;
```

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. In `packages/convex/convex/articles/mutations.ts`, add `const appUser = await getAppUser(ctx, ctx.user._id);` at the top of `deleteOrphanCoverVideo`'s handler (after the empty-args early return).
2. For each non-undefined `args.videoStorageId` and `args.posterStorageId`, lookup the ownership row by `by_storageId` and short-circuit out of that branch if the row is absent or `userId !== appUser._id`.
3. Apply the same pattern to `deleteOrphanCoverImage`.
4. Add a convex-test case: insert two `users` rows (A and B), seed an ownership row for A, sign in as B, call the mutation with A's storage id, assert the blob still exists.
5. Run `pnpm --filter=@feel-good/convex test`.
6. Re-run `pnpm --filter=@feel-good/mirror lint && pnpm --filter=@feel-good/mirror build`.

## Constraints

- Args validators MUST NOT add a `userId` field — userId is always derived server-side via `getAppUser`.
- The ownership-row absence (legitimate orphan from a partial cleanup) must be a no-op return, not a thrown error — otherwise legitimate retries break.
- No change to mutation return types: still `v.null()`.

## Resources

- `.claude/rules/embeddings.md` — cross-user isolation invariant
- `packages/convex/convex/articles/mutations.ts:44-56` — existing `assertCoverBlobOwnership` helper (mirror its shape, but skip-instead-of-throw for the orphan-delete path)
