---
id: FG_129
title: "Failed first-save of a new article with a cover does not orphan storage blobs"
date: 2026-05-05
type: fix
status: to-do
priority: p1
description: "Cover image bytes are uploaded before the create mutation runs; if create throws, the bytes stay in Convex storage with no owning row and no cleanup."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "After a forced `create` failure (e.g. duplicate slug) following a cover upload, no orphan blob remains in `_storage` (verified by query or scheduled sweep)."
  - "Either a server-side `internal` mutation deletes the orphan blob from the form's `catch` branch, OR a scheduled cron sweeps unreferenced cover blobs older than a TTL — pick one and document."
  - "A unit test simulates `uploadCover` success → `create` rejection and asserts the cleanup path was invoked."
owner_agent: "convex backend engineer"
---

# Failed first-save of a new article with a cover does not orphan storage blobs

## Context

Surfaced by the PR #34 code review (`code-review-pr34` batch). `apps/mirror/features/articles/hooks/use-new-article-form.tsx:80-112`: `handleCoverImageUpload` calls `uploadCover(file)` which POSTs the bytes to Convex storage and returns a `storageId`; the ID is saved in local state. `persist` then calls `create({..., coverImageStorageId})`. If `create` throws — slug collision is the realistic trigger because users iteratively try slugs — the bytes are already in `_storage` with no article row referencing them.

The cover-replacement orphan sweep at `packages/convex/convex/articles/mutations.ts:198-211` only fires from `update` (cover replacement), not from a create failure. There is no compensating delete on the client.

**Risk:** every failed first-save with a cover image leaks one storage object. On a Convex plan with storage quotas, repeated retry-after-collision flows accumulate unrecoverable orphans silently.

## Goal

Storage objects uploaded as covers but never linked to a successful article row are cleaned up — either eagerly (client-side compensating delete) or lazily (scheduled sweep within an acceptable TTL window).

## Scope

- Pick a single cleanup strategy (client-side compensating delete vs. server-side cron sweep).
- Implement and document the chosen strategy.
- Cover the create-failure path with a regression test.

## Out of Scope

- Cleanup for the cover-replacement path on `update` (already exists at mutations.ts:198-211).
- Cleanup for inline-image uploads (already covered by `inlineImageOwnership`).
- Cleanup for the edit-form clear path (covered by FG_124's removal sentinel + the existing `update` sweep).

## Approach

**Recommended: client-side compensating delete.** Add an `internal.articles.mutations.deleteOrphanCoverImage(storageId)` internal mutation that verifies (1) no `articles` row references the storageId, (2) the calling user owns the upload (via cover-image-ownership table from FG_147 if landed, otherwise a recency check). The form's `catch` branch in `persist` calls it via `useAction` or `useMutation`. Eager cleanup is preferable to a TTL sweep because it limits the orphan window to the failure instant.

If FG_147 (cover-image ownership) lands first, this ticket can reuse that ownership table. If not, do a `ctx.db.system.get("_storage", storageId)` recency check (within ~5 minutes of upload).

- **Effort:** Medium
- **Risk:** Medium (cleanup mutation must not delete a blob someone else owns)

## Implementation Steps

1. Add `internal.articles.mutations.deleteOrphanCoverImage` (or a similarly-named action) that takes `storageId: v.id("_storage")`, verifies no articles row references it, then calls `ctx.storage.delete(storageId)`.
2. In `use-new-article-form.tsx:persist`, wrap the `create({...})` call in try/catch; in the catch branch, if `coverImageStorageId` was set, schedule the orphan delete via the new internal mutation.
3. Add a test in `apps/mirror/features/articles/hooks/__tests__/use-new-article-form.test.ts` that mocks `create` to reject and asserts the cleanup mutation was called with the expected storageId.
4. Document the strategy in a comment at the top of `articles/mutations.ts` so future maintainers know which path handles which failure mode.

## Constraints

- The cleanup mutation MUST verify no article references the blob before deleting (cross-user copy/paste of storageIds is a known pattern per `workspace/lessons.md`).
- Must not introduce a TOCTOU between the reference scan and `ctx.storage.delete` — wrap them in the same mutation.

## Resources

- PR #34: https://github.com/hpark0011/mirror/pull/34
- Existing replacement-sweep: `packages/convex/convex/articles/mutations.ts:198-211`
- Lessons: `workspace/lessons.md` — "Inline storage cascade deletes must prove a blob is globally unreferenced..."
