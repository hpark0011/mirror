---
id: FG_189
title: "Hook tests must pin form-layer mutual exclusion (image upload clears video state and vice versa)"
date: 2026-05-08
type: fix
status: to-do
priority: p2
description: "Production hooks null out the opposite cover kind on each upload, but no test asserts coverImageStorageId becomes null after a video upload (or vice versa). A regression that removes the state-clearing lines would cause save to send both ids and the server would reject — uncovered."
dependencies: []
parent_plan_id: PLAN_010
acceptance_criteria:
  - "A new test in apps/mirror/features/articles/hooks/__tests__/use-new-article-form.test.ts uploads an image, then a video, asserts coverImageUrl/coverImageStorageId is null after the second upload"
  - "A sibling test does the inverse: uploads a video, then an image, asserts coverVideoUrl/coverVideoStorageId/coverVideoPosterStorageId is null"
  - "Same pair of tests added to use-edit-article-form.test.ts"
  - "`pnpm --filter=@feel-good/mirror test:unit -- use-new-article-form use-edit-article-form` passes"
owner_agent: "QA Test Engineer"
---

# Hook Tests Must Pin Form-Layer Mutual Exclusion (Image Upload Clears Video State and Vice Versa)

## Context

Both form hooks implement local-state mutual exclusion in their `handleCoverUpload`:

- `useNewArticleForm` (lines 137-142, 159-168): video upload nulls image state; image upload nulls video state.
- `useEditArticleForm` (lines 117-122, 142-150): same pattern.

This local-state guard is what guarantees `persistValidated` never sends BOTH `coverImageStorageId` AND `coverVideoStorageId` to the server (the server would reject with "mutually exclusive"). The state-clearing is load-bearing for the success of every save that involves a cover swap.

No hook-level test asserts this contract. If a future regression removes `setCoverImageStorageId(null)` from the video upload branch, the existing tests pass — and a real save would fail at the server boundary with a confusing error.

- **Source:** Code review of PLAN_010 article-cover-video branch
- **Location:** `apps/mirror/features/articles/hooks/use-new-article-form.tsx:137-142,159-168` and `use-edit-article-form.tsx:117-122,142-150`
- **Evidence:** Production code clears state correctly; no test asserts the cleared state.

## Goal

Each form hook test file pins the mutual-exclusion contract: after uploading the opposite cover kind, the prior cover's local state is null.

## Scope

- Add four new tests (one pair per hook):
  - upload image → upload video → assert image state nulled
  - upload video → upload image → assert video state nulled

## Out of Scope

- Server-side mutual-exclusion testing (covered by existing convex-test cases at `mutations.test.ts:657-680`).
- Adding tests for the picker's preview switch.

## Approach

```ts
it("uploading a video clears coverImageUrl and coverImageStorageId", async () => {
  mockUploadCoverImage.mockResolvedValue({ storageId: "img_1", thumbhash: "" });
  mockUploadCoverVideo.mockResolvedValue({
    videoStorageId: "vid_1",
    posterStorageId: "poster_1",
  });
  const { result } = renderHook(() => useNewArticleForm({ username: "test-user" }));

  await act(async () => {
    await result.current.handleCoverUpload(
      new File([new Uint8Array([1])], "c.png", { type: "image/png" }),
    );
  });
  expect(result.current.coverImageUrl).not.toBeNull();

  await act(async () => {
    await result.current.handleCoverUpload(
      new File([new Uint8Array([1])], "v.mp4", { type: "video/mp4" }),
    );
  });
  expect(result.current.coverImageUrl).toBeNull();
});
```

Mirror for the inverse case. Add the same pair in `use-edit-article-form.test.ts`, seeding the initial article appropriately.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Add the four tests across the two test files.
2. Stub `URL.createObjectURL` / `revokeObjectURL` if the existing test setup doesn't already.
3. Run `pnpm --filter=@feel-good/mirror test:unit -- use-new-article-form use-edit-article-form`.
4. Run `pnpm --filter=@feel-good/mirror lint`.

## Constraints

- Tests must use the same upload-mock shape as the existing tests.
- No production-code change.

## Resources

- Source: `apps/mirror/features/articles/hooks/use-new-article-form.tsx:128-180`
- Existing tests: the orphan-cleanup pair at lines 347-438 in the new-form test file is a good pattern reference.
