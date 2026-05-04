---
id: FG_124
title: "Cover Remove in edit mode actually clears the server-side cover"
date: 2026-05-05
type: fix
status: completed
priority: p0
description: "Clicking Remove on the cover image in the article edit form and saving leaves the cover image on the server unchanged because the patch payload omits the field."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "After uploading a cover, clicking Remove, then Save, a fresh `getBySlug` query returns no `coverImageUrl` for that article."
  - "A unit test for `useEditArticleForm` calls `handleCoverImageClear()` then `save()` and asserts the `update` mutation receives an explicit removal signal (not `undefined`) for the cover field."
  - "`pnpm build --filter=@feel-good/mirror` and `pnpm lint --filter=@feel-good/mirror` pass."
  - "`pnpm --filter=@feel-good/convex exec tsc --noEmit` passes after the mutation arg validator change."
owner_agent: "convex backend + frontend engineer"
---

# Cover Remove in edit mode actually clears the server-side cover

## Context

Surfaced by the PR #34 code review (`code-review-pr34` batch). `apps/mirror/features/articles/hooks/use-edit-article-form.tsx:97-100,111`: `handleCoverImageClear` sets `coverImageStorageId` to `null`; `persist` then sends `coverImageStorageId: coverImageStorageId ?? undefined`, which evaluates to `undefined` when the user just cleared. The `update` mutation at `packages/convex/convex/articles/mutations.ts:185` only patches the field when the arg is not `undefined`, so the server cover is never cleared. After `router.refresh()` the reactive query returns the original cover and the user sees it reappear.

CodeRabbit raised this as a Major (PR thread r3181866569). The current API has no way for the client to signal "remove this cover" because the `update` validator is `coverImageStorageId: v.optional(v.id("_storage"))` — there is no null/sentinel value the server can interpret as removal.

## Goal

Clicking Remove on the cover image and saving permanently removes the cover from the article on the server.

## Scope

- Add an explicit removal mechanism to the `update` mutation (separate `clearCoverImage: v.optional(v.boolean())` arg or widen the validator to `v.union(v.id("_storage"), v.null())`).
- Update `useEditArticleForm.persist` to send the removal signal when the user has cleared the cover, distinct from "no change."
- Cover-clear happens via `ctx.db.patch` writing `coverImageStorageId: undefined` server-side (Convex's documented removal path for optional fields).

## Out of Scope

- New-article flow (`use-new-article-form.tsx`) — clearing during defer-create simply discards local state with no server round-trip; no fix needed.
- Cover blob deletion (orphan storage cleanup) — covered by FG_129.
- Blob URL revocation on clear — covered by FG_132.

## Approach

Recommended: introduce a separate `coverIntent` discriminated union or a sibling `clearCoverImage: v.optional(v.boolean())` arg. The boolean arg is simpler and least-invasive. Track an `isCoverCleared` boolean in the form hook that flips to `true` on `handleCoverImageClear()` and resets when a new image is uploaded. `persist` sends `clearCoverImage: true` when set, otherwise sends `coverImageStorageId` only when the user uploaded a new image.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. In `packages/convex/convex/articles/mutations.ts`, add `clearCoverImage: v.optional(v.boolean())` to the `update` args validator.
2. In the `update` handler, after the existing `args.coverImageStorageId` patch branch, add: `if (args.clearCoverImage) patch.coverImageStorageId = undefined;` and ensure the existing cover-replacement orphan sweep at lines 198-211 runs for both branches.
3. In `apps/mirror/features/articles/hooks/use-edit-article-form.tsx`, add `const [isCoverCleared, setIsCoverCleared] = useState(false);`, set it `true` in `handleCoverImageClear`, set it `false` in `handleCoverImageUpload`.
4. In `persist`, send `clearCoverImage: isCoverCleared || undefined` and only send `coverImageStorageId` when `coverImageStorageId !== null`.
5. After a successful save, reset `isCoverCleared` to `false`.
6. Add a Vitest unit test under `apps/mirror/features/articles/hooks/__tests__/use-edit-article-form.test.ts` covering the upload→clear→save → mutation-receives-`clearCoverImage:true` path.

## Constraints

- Must not change the `articles` table schema field shape (`coverImageStorageId` stays `v.optional(v.id("_storage"))`).
- The orphan-blob cleanup branch at `mutations.ts:198-211` must run when `clearCoverImage: true` removes an existing cover.

## Resources

- PR #34: https://github.com/hpark0011/mirror/pull/34
- CodeRabbit thread: https://github.com/hpark0011/mirror/pull/34#discussion_r3181866569
