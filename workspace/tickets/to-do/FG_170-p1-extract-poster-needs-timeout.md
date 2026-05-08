---
id: FG_170
title: "extractPosterBlob hangs picker indefinitely on stalled MP4 decode"
date: 2026-05-08
type: fix
status: to-do
priority: p1
description: "The two awaited promises in extractPosterBlob (loadedmetadata and seeked) have no timeout. A container that fires loadedmetadata but stalls on seek hangs the picker forever — every interactive control is disabled and the user must reload the page."
dependencies: []
parent_plan_id: PLAN_010
acceptance_criteria:
  - "`grep -n 'Promise.race\\|setTimeout' apps/mirror/features/articles/hooks/use-article-cover-video-upload.ts` shows a Promise.race wrapping each event-await with a setTimeout-based rejection"
  - "A vitest test mounts the hook, fires the loadedmetadata event but never the seeked event, advances fake timers past the timeout, asserts the upload promise rejects with a 'timed out' error AND the URL.revokeObjectURL is called (finally ran)"
  - "`pnpm --filter=@feel-good/mirror test:unit -- use-article-cover-video-upload` passes"
  - "`pnpm --filter=@feel-good/mirror lint` exits 0"
owner_agent: "React Hooks Engineer"
---

# extractPosterBlob Hangs Picker Indefinitely on Stalled MP4 Decode

## Context

`extractPosterBlob` (`apps/mirror/features/articles/hooks/use-article-cover-video-upload.ts:80-116`) awaits two browser events in sequence: `loadedmetadata` (resolves on metadata load, rejects on `error`) and `seeked` (resolves on seek completion, rejects on `error`). Neither await has a timeout, an AbortSignal, or a fallback path.

A real-world failure mode: a container that fires `loadedmetadata` successfully but where the browser silently drops the seek (HEVC-in-MP4 on Chrome without HW decode, truncated `moov` atom, certain WebKit edge cases). Neither `seeked` nor `error` fires. The promise hangs forever.

The picker (`cover-image-picker.tsx`) sets `isUploading=true` before calling `onUpload(file)`. While `isUploading` is true, the file input, Add Cover button, Replace button, and Remove button are all disabled (lines 112, 151, 164, 177). With no progress indicator and no error path, the user must reload the page to escape.

- **Source:** Code review of PLAN_010 article-cover-video branch
- **Location:** `apps/mirror/features/articles/hooks/use-article-cover-video-upload.ts:80-116`
- **Evidence:** No `Promise.race`, `setTimeout`, or `AbortController` in either of the two event-await blocks; the picker's disabled-state guard cannot recover.

## Goal

A stalled video decode produces a user-visible error within ~10 seconds instead of an indefinite UI lock. The finally block runs on timeout, releasing the object URL.

## Scope

- Wrap each event-await in `Promise.race` with a setTimeout-based rejection.
- Confirm the existing finally block's `URL.revokeObjectURL` runs on timeout rejection.
- Add a vitest regression test using fake timers.

## Out of Scope

- Adding a per-second progress indicator (UX improvement, separate ticket).
- Replacing the hidden-video extraction with a server-side ffmpeg pipeline (rejected in plan D2).

## Approach

```ts
const POSTER_TIMEOUT_MS = 10_000;

function awaitEvent<T>(p: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Video decode timed out (${label})`)),
        POSTER_TIMEOUT_MS,
      ),
    ),
  ]);
}
```

Wrap both the `loadedmetadata` and `seeked` awaits with `awaitEvent(…, "loadedmetadata" | "seeked")`. The existing `finally { URL.revokeObjectURL(url); }` already runs on rejection, so the URL leak from a stalled hang is fixed as a side effect.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Define `POSTER_TIMEOUT_MS` and `awaitEvent` at module scope in `use-article-cover-video-upload.ts`.
2. Wrap the `loadedmetadata` Promise (line 80) with `awaitEvent`.
3. Wrap the `seeked` Promise (line 102) with `awaitEvent`.
4. Add a vitest test that uses `vi.useFakeTimers()`, mounts the hook, fires only `loadedmetadata`, advances `vi.advanceTimersByTime(11_000)`, asserts the upload promise rejects with a 'timed out' error.
5. Add a separate test that fires `loadedmetadata` and then waits without firing `seeked`, asserts the same.
6. Confirm the finally block's `URL.revokeObjectURL` is called on the timeout path (spy on `URL.revokeObjectURL`).
7. Run `pnpm --filter=@feel-good/mirror test:unit -- use-article-cover-video-upload`.
8. Run `pnpm --filter=@feel-good/mirror lint && pnpm --filter=@feel-good/mirror build`.

## Constraints

- Timeout value (10s) must accommodate slow 25-MiB MP4 decoding on mid-range mobile. If 10s proves too tight in QA, raise to 15s — but do not remove the timeout.
- The error message must propagate to the picker's toast handler so the user knows the upload failed.

## Resources

- Source: `apps/mirror/features/articles/hooks/use-article-cover-video-upload.ts:80-141`
- Plan: `workspace/plans/2026-05-08-article-cover-video-plan.md` (D2: poster extraction)
