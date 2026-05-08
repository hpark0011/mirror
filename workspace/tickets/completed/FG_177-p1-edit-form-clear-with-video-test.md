---
id: FG_177
title: "useEditArticleForm clear-cover-when-video has no test"
date: 2026-05-08
type: fix
status: completed
priority: p1
description: "The clearCoverImage:true assertion uses an INITIAL_ARTICLE fixture that has only coverImageUrl set. No test asserts that clearing a video cover sends clearCoverImage:true with no video ids. The invariant 'clearCoverImage wipes EVERY cover surface' has only half coverage."
dependencies: []
parent_plan_id: PLAN_010
acceptance_criteria:
  - "`grep -n 'INITIAL_ARTICLE_WITH_VIDEO\\|coverVideoUrl' apps/mirror/features/articles/hooks/__tests__/use-edit-article-form.test.ts` shows a fixture with coverVideoUrl + coverVideoPosterUrl set and a test exercising it"
  - "A new test calls handleCoverClear + save against the video fixture and asserts the mutation receives clearCoverImage:true with coverVideoStorageId and coverVideoPosterStorageId both undefined"
  - "`pnpm --filter=@feel-good/mirror test:unit -- use-edit-article-form` passes"
  - "`pnpm --filter=@feel-good/mirror lint` exits 0"
owner_agent: "QA Test Engineer"
---

# useEditArticleForm Clear-Cover-When-Video Has No Test

## Context

The `INITIAL_ARTICLE` fixture (`apps/mirror/features/articles/hooks/__tests__/use-edit-article-form.test.ts:70-82`) defines an article with `coverImageUrl` set and no video fields. The "save sends clearCoverImage:true after a clear" test (lines 97-125) exercises this fixture, calls `handleCoverClear`, and asserts the mutation receives `clearCoverImage: true` and `coverImageStorageId: undefined`.

There is NO test where the initial article has `coverVideoUrl` and the user clears it. The production code path in `use-edit-article-form.tsx:165-184` does null out video state on clear, but that contract is unpinned. A regression that nullifies only image fields (line 180-181) but forgets the video nullification (line 182-183) would let a stale video storageId leak into the next save.

The invariant from PLAN_010 is "`clearCoverImage: true` wipes EVERY cover surface" (image, video, poster). The current test coverage only proves it for the image surface.

- **Source:** Code review of PLAN_010 article-cover-video branch
- **Location:** `apps/mirror/features/articles/hooks/__tests__/use-edit-article-form.test.ts:97-125`
- **Evidence:** Test fixture has only `coverImageUrl`; no parallel fixture or test for video.

## Goal

A dedicated regression test pins the contract that clearing a video cover sends `clearCoverImage: true` with all three cover-storage-id fields undefined.

## Scope

- Add an `INITIAL_ARTICLE_WITH_VIDEO` fixture seeded with `coverVideoUrl` + `coverVideoPosterUrl` and the corresponding storage ids.
- Add a regression test that exercises the clear-then-save path against this fixture.

## Out of Scope

- Refactoring the existing `INITIAL_ARTICLE` fixture (keep both — they exercise different scenarios).
- Adding the form-layer mutual-exclusion tests (FG_189).
- Adding a test for clearing a no-cover article (already implicitly covered by other tests).

## Approach

```ts
const INITIAL_ARTICLE_WITH_VIDEO: any = {
  ...INITIAL_ARTICLE,
  coverImageUrl: null,
  coverImageThumbhash: undefined,
  coverVideoUrl: "https://example.com/v.mp4",
  coverVideoPosterUrl: "https://example.com/p.jpg",
};

it("save sends clearCoverImage:true with no video ids when video cover is cleared", async () => {
  mockUpdate.mockResolvedValue(null);
  const { result } = renderHook(() =>
    useEditArticleForm({
      username: "test-user",
      initial: INITIAL_ARTICLE_WITH_VIDEO,
    }),
  );

  act(() => {
    result.current.handleCoverClear();
  });

  await act(async () => {
    await result.current.save();
  });

  expect(mockUpdate).toHaveBeenCalledTimes(1);
  const args = mockUpdate.mock.calls[0]![0];
  expect(args.clearCoverImage).toBe(true);
  expect(args.coverVideoStorageId).toBeUndefined();
  expect(args.coverVideoPosterStorageId).toBeUndefined();
  expect(args.coverImageStorageId).toBeUndefined();
});
```

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. In `apps/mirror/features/articles/hooks/__tests__/use-edit-article-form.test.ts`, declare `INITIAL_ARTICLE_WITH_VIDEO` next to the existing fixture.
2. Add the regression test inside the `useEditArticleForm — cover clear` describe block.
3. Run `pnpm --filter=@feel-good/mirror test:unit -- use-edit-article-form`.
4. Run `pnpm --filter=@feel-good/mirror lint`.

## Constraints

- Don't replace the existing image-only fixture — it covers a different case (image clear).
- Don't make production-code changes in this ticket — pure test addition.

## Resources

- Source: `apps/mirror/features/articles/hooks/use-edit-article-form.tsx:165-184`
- Existing test: `apps/mirror/features/articles/hooks/__tests__/use-edit-article-form.test.ts:97-125`
