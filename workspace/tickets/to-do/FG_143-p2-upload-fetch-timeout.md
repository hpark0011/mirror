---
id: FG_143
title: "uploadToStorage fetch has a timeout and surfaces stalled uploads"
date: 2026-05-05
type: fix
status: to-do
priority: p2
description: "The cover and inline image upload fetch has no AbortSignal; a stalled connection leaves hasPendingUploads true forever, permanently disabling Save and Publish."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "`apps/mirror/lib/upload-to-storage.ts` passes `signal: AbortSignal.timeout(60_000)` (or a configurable timeout) to `fetch`."
  - "On a simulated stalled upload, the upload promise rejects within the timeout window and the form's `hasPendingUploads` returns to `false`."
  - "The user-visible error message indicates a timeout and offers a retry path (toast text or inline message)."
  - "`pnpm build --filter=@feel-good/mirror` passes."
owner_agent: "frontend engineer (React)"
---

# uploadToStorage fetch has a timeout and surfaces stalled uploads

## Context

Surfaced by the PR #34 code review (`code-review-pr34` batch; reliability reviewer). `apps/mirror/lib/upload-to-storage.ts:8-28` calls `fetch(uploadUrl, { method: "POST", headers: ..., body: file })` with no `AbortSignal` and no timeout. Convex presigned-URL POSTs are single-use and expire, but the client-side `fetch` itself is unbounded. A stalled connection (mobile network handoff, flaky Wi-Fi) leaves the promise pending forever.

The form hooks gate Save/Publish on `hasPendingUploads === false`. If `uploadCover` never resolves, `hasPendingUploads` stays `true`, and the user is stuck — no retry, no feedback, no save path.

**Risk:** unrecoverable stuck state. User loses unsaved article content if they reload the tab to escape.

## Goal

A stalled upload rejects within a bounded window; the user sees a meaningful error and can retry.

## Scope

- Add `AbortSignal.timeout(60_000)` (or similar) to the `fetch` call in `uploadToStorage`.
- Surface the timeout as a user-visible toast (already wired through the existing error path once `(error as Error).message` is fixed by FG_138).

## Out of Scope

- Resumable uploads.
- Progress indicators.
- Retry-with-backoff logic.

## Approach

Single signal addition. 60 seconds is a generous default for an image upload on a slow mobile network; the existing `hasPendingUploads` flag plus the toast give the user agency.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. In `apps/mirror/lib/upload-to-storage.ts:12`, add `signal: AbortSignal.timeout(60_000)` to the `fetch` options.
2. Verify the existing error propagation path surfaces the `TimeoutError` to the user via the form hook's catch branch.
3. (After FG_138 lands) Confirm the toast shows a meaningful message, not "Failed to upload: undefined".

## Constraints

- 60s default; do not make it configurable until a real need surfaces.
- Must not break the existing happy-path.

## Resources

- PR #34: https://github.com/hpark0011/mirror/pull/34
- MDN AbortSignal.timeout: https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static
