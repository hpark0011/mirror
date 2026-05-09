---
id: FG_201
title: "INITIAL_ARTICLE_WITH_VIDEO fixture omits storage ids → cover-clear test passes vacuously"
date: 2026-05-09
type: fix
status: to-do
priority: p2
description: "The fixture FG_177 added to use-edit-article-form.test.ts seeds coverVideoUrl + coverVideoPosterUrl but not coverVideoStorageId / coverVideoPosterStorageId. As a result, handleCoverClear's setCoverVideoStorageId(null) / setCoverVideoPosterStorageId(null) calls are no-ops in the test (state already nullish), and the post-clear assertion `args.coverVideoStorageId).toBeUndefined()` is satisfied without exercising the production code under test. A regression that removed those setters from handleCoverClear would still pass."
dependencies: []
parent_plan_id: PLAN_010
acceptance_criteria:
  - "`grep -n 'coverVideoStorageId\\|coverVideoPosterStorageId' apps/mirror/features/articles/hooks/__tests__/use-edit-article-form.test.ts` shows the INITIAL_ARTICLE_WITH_VIDEO fixture seeded with non-null fixture ids for both fields"
  - "Mutating the production code to remove `setCoverVideoStorageId(null)` (or `setCoverVideoPosterStorageId(null)`) from `handleCoverClear` causes the existing `save sends clearCoverImage:true with no video ids when video cover is cleared` test to FAIL — verified manually with the regression simulated, then reverted"
  - "`pnpm --filter=@feel-good/mirror test:unit -- use-edit-article-form` passes"
  - "`pnpm --filter=@feel-good/mirror lint` exits 0"
owner_agent: "QA Test Engineer"
---

# INITIAL_ARTICLE_WITH_VIDEO Fixture Omits Storage Ids → Cover-Clear Test Passes Vacuously

## Context

`apps/mirror/features/articles/hooks/__tests__/use-edit-article-form.test.ts:86-92` defines:

```ts
const INITIAL_ARTICLE_WITH_VIDEO: any = {
  ...INITIAL_ARTICLE,
  coverImageUrl: null,
  coverImageThumbhash: undefined,
  coverVideoUrl: "https://example.com/cover.mp4",
  coverVideoPosterUrl: "https://example.com/poster.jpg",
};
```

The fixture seeds the URL fields but omits `coverVideoStorageId` and `coverVideoPosterStorageId`. When `useEditArticleForm` is initialized from this fixture, those two state fields start as `null` (the `?? null` initializer collapses `undefined` → `null`).

The test at lines 138-166 then calls `handleCoverClear()` and asserts the resulting `update` mutation receives `coverVideoStorageId: undefined` and `coverVideoPosterStorageId: undefined`. The hook computes the mutation args as `coverVideoStorageId !== null ? coverVideoStorageId : undefined`, so:

- WITHOUT storage ids in the fixture: state is already `null` before clear; clear's `setCoverVideoStorageId(null)` is a no-op; arg is `undefined`. Test passes — but ONLY because the state was never non-null in the first place.
- WITH storage ids in the fixture: state holds the seeded id; clear transitions state from id → `null`; arg is `undefined`. Test passes because the production code actually did its job.

The intent of FG_177 was to lock down "`clearCoverImage: true` wipes EVERY cover surface" — including the storage-id state transitions in `handleCoverClear` (`use-edit-article-form.tsx:182-183`). The current fixture does NOT exercise those transitions. A regression that removed those two setters would not be caught.

CodeRabbit flagged this in the PR #69 review at `workspace/tickets/completed/FG_177-...md:57`. FG_177 is marked completed because the test was added — but the test is a false positive against its own stated regression. This ticket tightens the fixture so the test actually proves what FG_177's acceptance criteria claim.

- **Source:** PR #69 review by CodeRabbit; verified by re-reading the fixture and the test against `useEditArticleForm.handleCoverClear` (`use-edit-article-form.tsx:165-184`).
- **Location:** `apps/mirror/features/articles/hooks/__tests__/use-edit-article-form.test.ts:86-92`
- **Evidence:** Fixture lacks `coverVideoStorageId` / `coverVideoPosterStorageId`; the post-clear assertion is satisfied for both the production code and a regressed-production-code variant.

## Goal

The video-clear test fails when the production `handleCoverClear` is regressed to skip the video / poster storage-id resets — i.e., the test actually proves the contract its acceptance criteria claim.

## Scope

- Add `coverVideoStorageId` and `coverVideoPosterStorageId` (with non-null fixture values, e.g. `"kg_video_fixture_id"` / `"kg_poster_fixture_id"`) to `INITIAL_ARTICLE_WITH_VIDEO`.
- Optionally add a sibling `coverImageStorageId` to `INITIAL_ARTICLE` if the existing image-clear test (lines 108-136) has the same vacuous-pass shape — verify before changing.
- No production code changes.

## Out of Scope

- Refactoring the hook's `?? null` initializer pattern.
- Adding new tests beyond the fixture-completion fix (separate test additions go in their own tickets).
- Changes to `useNewArticleForm`'s tests — that hook has no `INITIAL_ARTICLE` fixture (it starts blank).

## Approach

```ts
const INITIAL_ARTICLE_WITH_VIDEO: any = {
  ...INITIAL_ARTICLE,
  coverImageUrl: null,
  coverImageStorageId: undefined,
  coverImageThumbhash: undefined,
  coverVideoUrl: "https://example.com/cover.mp4",
  coverVideoPosterUrl: "https://example.com/poster.jpg",
  // Storage ids MUST be present; otherwise handleCoverClear's
  // setCoverVideoStorageId(null) / setCoverVideoPosterStorageId(null)
  // are observably no-ops and the post-clear assertion passes vacuously.
  coverVideoStorageId: "kg_video_fixture_id",
  coverVideoPosterStorageId: "kg_poster_fixture_id",
};
```

After the fixture change, manually simulate the regression (comment out the two `setCoverVideoStorageId(null)` / `setCoverVideoPosterStorageId(null)` lines in `handleCoverClear`), confirm the test FAILS, then revert the simulation.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Edit `INITIAL_ARTICLE_WITH_VIDEO` in `apps/mirror/features/articles/hooks/__tests__/use-edit-article-form.test.ts` per the Approach snippet.
2. Verify by simulating the regression: comment out lines 182-183 in `use-edit-article-form.tsx` (the two video-clear setters), run `pnpm --filter=@feel-good/mirror test:unit -- use-edit-article-form`, confirm the video-clear test fails. Revert the simulation.
3. Inspect `INITIAL_ARTICLE` (lines ~70-83) for the same shape — if `coverImageStorageId` is missing and the image-clear test has the same false-positive pattern, add it too in the same commit.
4. Run `pnpm --filter=@feel-good/mirror test:unit -- use-edit-article-form`.
5. Run `pnpm --filter=@feel-good/mirror lint`.

## Constraints

- Pure test fixture / production-code-untouched ticket. Any production change goes in a separate ticket.
- Don't switch the fixture id strings to real `Id<"_storage">`-cast values — string literals are sufficient because the hook only does null/non-null comparisons on these fields.

## Resources

- Source: `apps/mirror/features/articles/hooks/__tests__/use-edit-article-form.test.ts:86-92, 138-166`
- Production handler: `apps/mirror/features/articles/hooks/use-edit-article-form.tsx:165-184` (`handleCoverClear`)
- Predecessor ticket (now completed): `workspace/tickets/completed/FG_177-p1-edit-form-clear-with-video-test.md`
- PR review thread: PR #69 CodeRabbit comment ID 3208284034
