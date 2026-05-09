---
id: FG_169
title: "Cover-video upload aborts on mid-stream poster failure leaving video bytes orphaned"
date: 2026-05-08
type: fix
status: completed
priority: p1
description: "When the poster uploadToStorage rejects mid-stream while the video upload is still in flight, Promise.all rejects but the video fetch is not aborted. The video bytes complete uploading and stay in _storage with no ownership row and no eager orphan cleanup, leaking until the cron sweep."
dependencies: []
parent_plan_id: PLAN_010
acceptance_criteria:
  - "`grep -n 'AbortController\\|abort' apps/mirror/features/articles/hooks/use-article-cover-video-upload.ts` shows abort-signal threading through both uploadToStorage calls OR the upload Promise.all is wrapped in a try/catch that fires deleteOrphanCoverVideo with whatever ids were obtained"
  - "A new vitest test simulates poster upload rejection, asserts the video fetch is aborted (no completion) OR the catch fires deleteOrphanCoverVideo with the partially-obtained video id"
  - "`pnpm --filter=@feel-good/mirror test:unit -- use-article-cover-video-upload` passes"
  - "`pnpm --filter=@feel-good/mirror lint && pnpm --filter=@feel-good/mirror build` exit 0"
owner_agent: "React Hooks Engineer"
---

# Cover-Video Upload Aborts on Mid-Stream Poster Failure Leaving Video Bytes Orphaned

## Context

`useArticleCoverVideoUpload.upload` does:

```ts
const [videoStorageId, posterStorageId] = await Promise.all([
  uploadToStorage(videoUrl, file),
  uploadToStorage(posterUrl, posterFile),
]);
```

If the poster upload rejects mid-stream (server 5xx, network drop), `Promise.all` rejects immediately but the video upload's underlying `fetch` is NOT aborted by Promise.all — it runs to completion in the background. When it does complete, the video bytes land in `_storage`. The catch+`deleteOrphanCoverVideo` block is INSIDE the claim try/catch (lines 187-198), not the upload try/catch — so the partial video bytes are not cleaned up by the hook.

The cron sweep is the eventual safety net (24h grace + 24h cron schedule = up to 48h leak window), but the fire-and-forget upload completion is unobservable to both the user and the operator.

- **Source:** Code review of PLAN_010 article-cover-video branch
- **Location:** `apps/mirror/features/articles/hooks/use-article-cover-video-upload.ts:179-198`
- **Evidence:** `Promise.all` does not abort sibling promises on rejection; the `catch (err) { void deleteOrphanCoverVideo(...) }` is only attached to the claim block, not the upload block.

## Goal

A failed cover-video upload (at any phase) does not leave video bytes stranded in `_storage` for hours. Either both uploads abort together via AbortController, or the upload-phase failure path eagerly fires `deleteOrphanCoverVideo` for whichever storage ids were obtained.

## Scope

- Either thread an AbortController through both `uploadToStorage` calls so a sibling rejection cancels the in-flight peer, OR wrap the upload `Promise.all` in its own try/catch that calls `deleteOrphanCoverVideo` with whichever ids were obtained.
- Add a vitest test that exercises the mid-stream-fail path.

## Out of Scope

- Aborting the poster-extraction phase (FG_170 covers that).
- Cleaning up ownership rows on partial success (FG_168, FG_179).
- Refactoring `uploadToStorage` to be cancellation-aware globally.

## Approach

**Preferred (AbortController):** create one `AbortController` at the top of `upload`. Pass `signal: controller.signal` into both `uploadToStorage` calls. Wrap the `Promise.all` in `try { … } catch (err) { controller.abort(); throw err; }`. `uploadToStorage` already accepts a fetch options bag — extend it to forward `signal` to `fetch`.

**Fallback:** keep the current shape but capture per-promise results separately:

```ts
let videoStorageId: Id<"_storage"> | undefined;
let posterStorageId: Id<"_storage"> | undefined;
try {
  [videoStorageId, posterStorageId] = await Promise.all([…]);
} catch (err) {
  if (videoStorageId || posterStorageId) {
    deleteOrphanCoverVideo({ videoStorageId, posterStorageId }).catch(…);
  }
  throw err;
}
```

The fallback doesn't actually capture per-promise results because Promise.all rejects on the first failure without exposing the others. The AbortController approach is cleaner.

- **Effort:** Medium
- **Risk:** Medium (touches the upload helper signature)

## Implementation Steps

1. Inspect `apps/mirror/lib/upload-to-storage.ts` to confirm whether it forwards `signal`. If not, extend the signature: `uploadToStorage(url, file, { signal? })`.
2. In `apps/mirror/features/articles/hooks/use-article-cover-video-upload.ts`, create `const controller = new AbortController()` at the top of `upload`.
3. Pass `{ signal: controller.signal }` into both `uploadToStorage` calls.
4. Wrap the `Promise.all` in try/catch that calls `controller.abort()` and re-throws.
5. Add a vitest test that mocks one upload to reject, asserts the controller's signal becomes aborted (test indirection: spy on `fetch` and verify the abort propagates).
6. Run `pnpm --filter=@feel-good/mirror test:unit -- use-article-cover-video-upload`.
7. Run `pnpm --filter=@feel-good/mirror lint && pnpm --filter=@feel-good/mirror build`.

## Constraints

- Don't break the existing image-upload helper signature — `uploadToStorage` is shared. Add `signal` as optional with a default behavior of "no abort signal."
- The thrown error must be re-thrown so the picker's UI state machine still flips to the error path.

## Resources

- Source: `apps/mirror/features/articles/hooks/use-article-cover-video-upload.ts:174-198`
- MDN AbortController + fetch reference
