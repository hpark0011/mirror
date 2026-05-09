---
id: FG_201
title: "Cover-clear test cannot reach the storage-id reset path → false positive against its stated regression-guard"
date: 2026-05-09
type: fix
status: completed
priority: p2
description: "FG_177 added a test asserting `clearCoverImage:true` wipes the video storage-id fields, but useEditArticleForm initializes those fields to null unconditionally (it never reads them from `initial`), so the post-clear assertion is satisfied vacuously. Adding storage ids to INITIAL_ARTICLE_WITH_VIDEO does NOT help — the hook ignores them. The only way to populate non-null storage-id state in tests is the upload path. Add an upload-then-clear test that actually exercises handleCoverClear's two setCoverVideoStorageId(null)/setCoverVideoPosterStorageId(null) lines."
dependencies: []
parent_plan_id: PLAN_010
acceptance_criteria:
  - "A new test in `apps/mirror/features/articles/hooks/__tests__/use-edit-article-form.test.ts` calls handleCoverUpload with a video file (after `mockUploadCoverVideo.mockResolvedValue({ videoStorageId, posterStorageId })`), then handleCoverClear, then save — and asserts the mutation receives `clearCoverImage: true` AND `coverVideoStorageId: undefined` AND `coverVideoPosterStorageId: undefined`"
  - "Manually simulating the regression — commenting out the two `setCoverVideoStorageId(null)` / `setCoverVideoPosterStorageId(null)` lines in `use-edit-article-form.tsx` (`handleCoverClear`) — causes the new test to FAIL with non-undefined storage-id args. Verified, then reverted."
  - "`pnpm --filter=@feel-good/mirror test:unit -- use-edit-article-form` passes"
  - "`pnpm --filter=@feel-good/mirror lint` exits 0"
owner_agent: "QA Test Engineer"
---

# Cover-Clear Test Cannot Reach the Storage-Id Reset Path

## Context

`apps/mirror/features/articles/hooks/use-edit-article-form.tsx:61-76` initializes
all three cover storage-id `useState`s to `null` unconditionally:

```ts
// The query returns cover *URLs* only — the server-side storage ids are
// not exposed. Until the user uploads a new cover, we keep the storage-id
// state at `null` and OMIT those fields from the patch …
const [coverImageStorageId, setCoverImageStorageId] = useState<Id<"_storage"> | null>(null);
…
const [coverVideoStorageId, setCoverVideoStorageId] = useState<Id<"_storage"> | null>(null);
const [coverVideoPosterStorageId, setCoverVideoPosterStorageId] = useState<Id<"_storage"> | null>(null);
```

Because the hook never reads `initial.cover{Image,Video,VideoPoster}StorageId`,
the only way to put non-null storage-id state into `useEditArticleForm` is the
`handleCoverUpload` path (which writes them via the upload-hook callback).

FG_177 added an `INITIAL_ARTICLE_WITH_VIDEO` fixture and a test that:

1. Renders the hook against the fixture (state: video URL set, all storage ids = null)
2. Calls `handleCoverClear()` (state: every storage id stays at null — `setX(null)` from null is a no-op)
3. Saves and asserts `args.coverVideoStorageId / coverVideoPosterStorageId` are `undefined`

The mutation arg is `coverVideoStorageId !== null ? coverVideoStorageId : undefined`, so the
assertion is satisfied because state was always null — not because the production code
under test (the two `setCoverVideoStorageId(null)` / `setCoverVideoPosterStorageId(null)`
calls in `handleCoverClear`) actually fired. A regression that removed those two lines
would not be caught.

CodeRabbit flagged the symptom in the PR #69 review (originally framed as a
fixture-completeness gap). On closer reading, the fix can't be a fixture change —
the hook ignores fixture storage ids by design. The test must reach storage-id state
via the upload path.

- **Source:** PR #69 review by CodeRabbit (comment 3208284034); deeper analysis
  during FG_201 resolution.
- **Location:** `apps/mirror/features/articles/hooks/__tests__/use-edit-article-form.test.ts:138-166`
- **Evidence:** Hook initializers at `use-edit-article-form.tsx:61-76` are
  hardcoded to `null` and never reference `initial.*StorageId`.

## Goal

A test exists that fails when `handleCoverClear` is regressed to skip the
`setCoverVideoStorageId(null)` and `setCoverVideoPosterStorageId(null)` calls.

## Scope

- Add ONE new test to the `useEditArticleForm — cover clear` describe block
  using the upload-then-clear pattern.
- Do NOT change the existing FG_177 test (rename / delete) — it still proves
  the `clearCoverImage: true` flag fires for a server-loaded video cover, even
  if it doesn't prove the storage-id reset path.
- Do NOT add an analogous upload-then-clear test for the image cover unless the
  same gap exists there (verify by inspection — image-clear test already passes
  without an image upload because state is always null too, so the same gap
  applies in principle; flag as a follow-up if the user wants symmetry).
- No production code changes.

## Out of Scope

- Refactoring the hook to read storage ids from `initial` (would invalidate the
  load-from-server design and require server-side schema/query plumbing).
- Mutating `INITIAL_ARTICLE_WITH_VIDEO` to add storage ids — has no effect (hook
  ignores them).
- Adding the analogous image upload-then-clear test (separate ticket if wanted).

## Approach

```ts
it("save sends clearCoverImage:true with no video ids after upload-then-clear", async () => {
  mockUpdate.mockResolvedValue(null);
  mockUploadCoverVideo.mockResolvedValue({
    videoStorageId: "video_storage_id",
    posterStorageId: "poster_storage_id",
  });
  const { result } = renderHook(() =>
    useEditArticleForm({
      username: "test-user",
      initial: INITIAL_ARTICLE,
    }),
  );

  // Upload populates storage-id state — without this, handleCoverClear's
  // setCoverVideoStorageId(null) / setCoverVideoPosterStorageId(null) are
  // no-ops and the assertion below passes vacuously.
  await act(async () => {
    await result.current.handleCoverUpload(
      new File([new Uint8Array([1])], "cover.mp4", { type: "video/mp4" }),
    );
  });

  act(() => {
    result.current.handleCoverClear();
  });

  await act(async () => {
    await result.current.save();
  });

  expect(mockUpdate).toHaveBeenCalledTimes(1);
  const args = mockUpdate.mock.calls[0]![0] as {
    clearCoverImage?: boolean;
    coverVideoStorageId?: unknown;
    coverVideoPosterStorageId?: unknown;
  };
  expect(args.clearCoverImage).toBe(true);
  expect(args.coverVideoStorageId).toBeUndefined();
  expect(args.coverVideoPosterStorageId).toBeUndefined();
});
```

After the test is in place, simulate the regression — comment out the two
`setCoverVideoStorageId(null)` / `setCoverVideoPosterStorageId(null)` lines in
`handleCoverClear` — and confirm the new test FAILS with
`coverVideoStorageId === "video_storage_id"`. Then revert the simulation.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Add the test above to `apps/mirror/features/articles/hooks/__tests__/use-edit-article-form.test.ts`,
   inside the `useEditArticleForm — cover clear` describe block (place it
   immediately after the existing video-cover-clear test for narrative grouping).
2. Run `pnpm --filter=@feel-good/mirror test:unit -- use-edit-article-form` —
   confirm the new test passes.
3. Verify the test actually pins the regression: comment out the two video-clear
   setters in `use-edit-article-form.tsx` (`handleCoverClear` block), re-run the
   test, confirm it fails with non-undefined storage-id args, revert.
4. Run `pnpm --filter=@feel-good/mirror lint`.

## Constraints

- Pure test addition. No production code changes.
- The new test reuses `INITIAL_ARTICLE` (NOT `INITIAL_ARTICLE_WITH_VIDEO`) because
  the upload path is what populates storage-id state — a server-loaded video URL
  has no bearing on the assertion.

## Resources

- Source: `apps/mirror/features/articles/hooks/__tests__/use-edit-article-form.test.ts:138-166`
- Production handler: `apps/mirror/features/articles/hooks/use-edit-article-form.tsx:165-184`
  (`handleCoverClear`)
- Hook init reference: `apps/mirror/features/articles/hooks/use-edit-article-form.tsx:61-76`
- Predecessor (completed): `workspace/tickets/completed/FG_177-p1-edit-form-clear-with-video-test.md`
- PR review thread: PR #69 CodeRabbit comment ID 3208284034

## Resolution

Resolved on 2026-05-09 by adding the upload-then-clear test (`save sends clearCoverImage:true with no video ids after upload-then-clear`) to `apps/mirror/features/articles/hooks/__tests__/use-edit-article-form.test.ts`. The cover-clear `describe` block's `beforeEach` was extended with `vi.stubGlobal("URL", { createObjectURL, revokeObjectURL })` (and `vi.unstubAllGlobals()` in `afterEach`) so the new test can invoke `handleCoverUpload` without breaking the surrounding cover-clear tests. The new test reuses `INITIAL_ARTICLE` because the upload path is the only way to populate non-null storage-id state — `INITIAL_ARTICLE_WITH_VIDEO` adds nothing here.

Regression simulation verified the new test pins the production code path: commenting out the two `setCoverVideoStorageId(null)` / `setCoverVideoPosterStorageId(null)` lines in `handleCoverClear` makes the test fail with `expected 'video_storage_id' to be undefined`. Reverted before commit.

No production code changes. The fixture-tightening framing CodeRabbit originally suggested (and the first FG_201 draft prescribed) doesn't work here — the hook initializes all three cover-storage-id `useState`s to `null` unconditionally, so seeding them in the fixture has no observable effect.

Symmetric upload-then-clear coverage for the image cover (verifying `setCoverImageStorageId(null)` in `handleCoverClear`) is NOT in scope for this ticket. File a follow-up if symmetric coverage is wanted.
