---
id: FG_147
title: "Article cover-image storage IDs are verified to belong to the calling user"
date: 2026-05-05
type: fix
status: to-do
priority: p2
description: "The articles create and update mutations accept coverImageStorageId from client args without verifying ownership; one user can pin another user's storage blob as their cover."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "`packages/convex/convex/articles/mutations.ts` rejects `create` and `update` calls when `coverImageStorageId` does not belong to the caller (verified via a new ownership table or a recency check on storage metadata)."
  - "An integration test (or unit test against the Convex test harness) verifies that user A cannot set their article's cover to a storageId uploaded by user B — the mutation throws."
  - "`pnpm --filter=@feel-good/convex exec tsc --noEmit` passes."
owner_agent: "convex backend engineer (security)"
---

# Article cover-image storage IDs are verified to belong to the calling user

## Context

Surfaced by the PR #34 code review (`code-review-pr34` batch; security reviewer). `packages/convex/convex/articles/mutations.ts` `create` (line 67) and `update` (line 185-186) accept `coverImageStorageId: v.optional(v.id("_storage"))` directly from client args and write it to the database without verifying that the `_storage` object was uploaded by the calling user.

Inline images already have `inlineImageOwnership` (FG_091's `claimInlineImageOwnership` + `filterCallerOwnedInlineIds`); cover images have no parallel guard.

**Risk:** authenticated user A who learns user B's storageId (via storage URL leakage, a shared draft body, the embeddings pipeline, or network logs) can pin that blob as their own article cover. A's article URL then surfaces user B's content under A's authorship.

## Goal

The articles mutations only accept `coverImageStorageId` values that the caller uploaded.

## Scope

- Add ownership verification to `create` and `update` mutations.
- Pick a strategy: a sibling `coverImageOwnership` table written by `generateArticleCoverImageUploadUrl`, OR a `ctx.db.system.get("_storage", id)` recency check.
- Add a regression test.

## Out of Scope

- Changing how inline-image ownership works (already wired).
- Backfilling ownership for existing cover images (assume rare, document as known gap if any).

## Approach

**Recommended: ownership table.** Mirror the inline-image pattern. `generateArticleCoverImageUploadUrl` writes a row to `coverImageOwnership` (`{userId, storageId, createdAt}`) at upload-URL generation time. `create` and `update` look up the row by `storageId`, verify `userId` matches `getAppUser(ctx, ctx.user._id)`, throw if not.

- **Effort:** Medium
- **Risk:** Medium (security-sensitive code path; needs careful test coverage)

## Implementation Steps

1. Add `coverImageOwnership` table to `packages/convex/convex/articles/schema.ts` (or a shared schema file): `userId, storageId, createdAt` indexed by `storageId`.
2. In `generateArticleCoverImageUploadUrl`, insert a row right after generating the URL.
3. In `create` and `update`, after auth and before writing `coverImageStorageId`, look up the ownership row and throw `ConvexError("cover image storage id does not belong to caller")` if missing or mismatched.
4. Add a test that creates a storage record under user A, attempts to use it under user B, and asserts the mutation throws.
5. Document the cleanup expectation: when the article is deleted or the cover is replaced, the corresponding ownership row should be cleaned up (file follow-up if not already covered by FG_124's removal sentinel).

## Constraints

- Must use `getAppUser(ctx, ctx.user._id)` for the userId comparison — never trust `args.userId`.
- Per `.claude/rules/embeddings.md`, the mutation's args validator MUST NOT include a `userId` field.

## Resources

- PR #34: https://github.com/hpark0011/mirror/pull/34
- Existing pattern: `inlineImageOwnership` (FG_091)
