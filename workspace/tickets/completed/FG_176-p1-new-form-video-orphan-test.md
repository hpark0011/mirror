---
id: FG_176
title: "useNewArticleForm video orphan cleanup branch needs dedicated test"
date: 2026-05-08
type: fix
status: completed
priority: p1
description: "The useMutation mock in the existing test file routes both deleteOrphanCoverImage and deleteOrphanCoverVideo to the same spy via substring match. The video-upload-then-create-failure path has zero coverage — the entire video-orphan branch in use-new-article-form.tsx is unpinned."
dependencies: []
parent_plan_id: PLAN_010
acceptance_criteria:
  - "`grep -n 'mockDeleteOrphanCoverVideo' apps/mirror/features/articles/hooks/__tests__/use-new-article-form.test.ts` shows a dedicated spy distinct from mockDeleteOrphanCoverImage"
  - "A new test mocks the video upload to resolve with {videoStorageId, posterStorageId}, mocks create to reject, asserts mockDeleteOrphanCoverVideo is called with both ids and that local cover state is cleared"
  - "`pnpm --filter=@feel-good/mirror test:unit -- use-new-article-form` passes"
  - "`pnpm --filter=@feel-good/mirror lint` exits 0"
owner_agent: "QA Test Engineer"
---

# useNewArticleForm Video Orphan Cleanup Branch Needs Dedicated Test

## Context

The mock at `apps/mirror/features/articles/hooks/__tests__/use-new-article-form.test.ts:23` routes both `deleteOrphanCoverImage` and `deleteOrphanCoverVideo` to a single spy via substring match `"deleteOrphan"`:

```ts
vi.mock("convex/react", () => ({
  useMutation: (ref: unknown) => {
    const s = String(ref);
    if (s.includes("deleteOrphan")) return mockDeleteOrphanCoverImage;
    if (s.includes("create")) return mockCreate;
    return vi.fn();
  },
}));
```

The `useArticleCoverVideoUpload` mock at line 35 is a plain `vi.fn()` with no `mockResolvedValue`. As a result:

- No test exercises the video-upload-then-create-failure path
- The entire video-orphan-cleanup branch (`use-new-article-form.tsx:220-234`) has zero coverage
- A regression that disables the video-orphan call would pass CI green

- **Source:** Code review of PLAN_010 article-cover-video branch
- **Location:** `apps/mirror/features/articles/hooks/__tests__/use-new-article-form.test.ts:23,35`
- **Evidence:** Single spy for two different mutations; video upload mock has no resolve value.

## Goal

A dedicated regression test pins the video-orphan-cleanup contract: when create fails after a video+poster upload, deleteOrphanCoverVideo is called with both ids and local cover state is wiped.

## Scope

- Replace the substring-match spy with two distinct spies: `mockDeleteOrphanCoverImage` and `mockDeleteOrphanCoverVideo`.
- Configure the video-upload mock to resolve with predictable storage ids.
- Add the regression test.

## Out of Scope

- Reworking the existing image-orphan tests (they keep working with `mockDeleteOrphanCoverImage`).
- The form-layer mutual-exclusion tests (FG_189).

## Approach

```ts
const mockDeleteOrphanCoverImage = vi.fn();
const mockDeleteOrphanCoverVideo = vi.fn();
const mockUploadCoverVideo = vi.fn();

vi.mock("convex/react", () => ({
  useMutation: (ref: unknown) => {
    const s = String(ref);
    if (s.includes("deleteOrphanCoverVideo")) return mockDeleteOrphanCoverVideo;
    if (s.includes("deleteOrphanCoverImage")) return mockDeleteOrphanCoverImage;
    if (s.includes("create")) return mockCreate;
    return vi.fn();
  },
}));

vi.mock("../use-article-cover-video-upload", () => ({
  useArticleCoverVideoUpload: () => ({ upload: mockUploadCoverVideo }),
}));
```

Test:

```ts
it("calls deleteOrphanCoverVideo with both ids when create fails after video upload", async () => {
  mockUploadCoverVideo.mockResolvedValue({
    videoStorageId: "vid_abc",
    posterStorageId: "poster_abc",
  });
  mockCreate.mockRejectedValue(new Error("Slug already exists"));
  mockDeleteOrphanCoverVideo.mockResolvedValue(null);
  // … render hook, set title/category, handleCoverUpload(videoFile), save()
  expect(mockDeleteOrphanCoverVideo).toHaveBeenCalledTimes(1);
  expect(mockDeleteOrphanCoverVideo).toHaveBeenCalledWith({
    videoStorageId: "vid_abc",
    posterStorageId: "poster_abc",
  });
  expect(result.current.coverVideoUrl).toBeNull();
});
```

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. In `apps/mirror/features/articles/hooks/__tests__/use-new-article-form.test.ts`, declare a new `mockDeleteOrphanCoverVideo` spy.
2. Update the `useMutation` mock to route by exact-mutation-name suffix instead of substring.
3. Replace the inline `vi.fn()` for the video upload mock with the named `mockUploadCoverVideo` spy.
4. Add the regression test described in the Approach above.
5. Add a sibling negative-case test: create fails WITHOUT a video upload — assert `mockDeleteOrphanCoverVideo` is NOT called.
6. Run `pnpm --filter=@feel-good/mirror test:unit -- use-new-article-form`.
7. Run `pnpm --filter=@feel-good/mirror lint`.

## Constraints

- The existing image-orphan tests must still pass — the new spies must not break their mock routing.
- Don't change production code in this ticket — pure test addition.

## Resources

- Source: `apps/mirror/features/articles/hooks/use-new-article-form.tsx:217-234`
- Existing test: `apps/mirror/features/articles/hooks/__tests__/use-new-article-form.test.ts:347-378`
