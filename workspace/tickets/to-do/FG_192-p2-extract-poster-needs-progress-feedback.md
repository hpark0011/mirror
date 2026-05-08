---
id: FG_192
title: "Cover-video upload needs a 'Preparing…' state so users see progress during poster extraction"
date: 2026-05-08
type: improvement
status: to-do
priority: p2
description: "extractPosterBlob runs before upload URLs are requested. For a 25 MiB MP4 on mobile the GOP decode + canvas encode can take 1-4 seconds while the picker shows 'Uploading…' — misleading because no upload has actually started."
dependencies: ["FG_173"]
parent_plan_id: PLAN_010
acceptance_criteria:
  - "The picker exposes a tri-state `data-cover-upload-state` attribute: `idle | preparing | uploading | ready`"
  - "While extractPosterBlob is running, the state is `preparing` and the button label shows 'Preparing…'"
  - "Once the upload Promise.all kicks off, state flips to `uploading` and label shows 'Uploading…'"
  - "The existing e2e wait on `data-cover-upload-state='ready'` continues to pass"
owner_agent: "React Hooks Engineer"
---

# Cover-Video Upload Needs a 'Preparing…' State So Users See Progress During Poster Extraction

## Context

`useArticleCoverVideoUpload.upload` (`apps/mirror/features/articles/hooks/use-article-cover-video-upload.ts:160-209`) runs `extractPosterBlob(file)` BEFORE issuing the upload URLs. For a 25 MiB MP4 on a mid-range mobile device, this phase decodes the first GOP and encodes a JPEG — measured at 1-4 seconds.

During this entire phase, the picker (`cover-image-picker.tsx`) reports `isUploading=true` and the button label says "Uploading…" — but no upload bytes have left the browser yet. Users on slow connections may rightly assume the app froze and abandon the session.

- **Source:** Code review of PLAN_010 article-cover-video branch
- **Location:** `apps/mirror/features/articles/hooks/use-article-cover-video-upload.ts:70-209` and `cover-image-picker.tsx:95-99`
- **Evidence:** No state distinction between "preparing" (decoding poster) and "uploading" (transferring bytes).

## Goal

The picker shows distinct labels and a distinct deterministic state for the poster-extraction phase vs. the upload phase. Users on slow devices understand what's happening.

## Scope

- Add a `preparing` state to the upload state machine (in addition to the existing `idle | uploading | ready`).
- Surface the state via the picker's existing `data-cover-upload-state` data attribute.
- Update the button label.

## Out of Scope

- Adding per-byte upload progress (separate UX work).
- Refactoring the entire state machine.
- Affecting the e2e contract — `data-cover-upload-state="ready"` must still flip at the same moment.

## Approach

The state lives in the parent hook (per FG_186 considerations). Expose `coverUploadState: 'idle' | 'preparing' | 'uploading' | 'ready'` and thread it through to the picker via props.

In `useArticleCoverVideoUpload.upload`:
```ts
async (file: File) => {
  validateFile(file);
  setCoverUploadState('preparing');  // ← new
  const posterBlob = await extractPosterBlob(file);
  …
  setCoverUploadState('uploading');  // ← new
  const [videoStorageId, posterStorageId] = await Promise.all([…]);
  …
  setCoverUploadState('ready');
}
```

Picker label:
```ts
const label = uploadState === 'preparing' ? 'Preparing…' : uploadState === 'uploading' ? 'Uploading…' : 'Add Cover';
```

- **Effort:** Medium
- **Risk:** Low

## Implementation Steps

1. Add `coverUploadState` state to the parent hooks (`useEditArticleForm` + `useNewArticleForm`).
2. Plumb the state into `useArticleCoverVideoUpload` via callback (or hoist the extraction into the parent — TBD by impl).
3. In `cover-image-picker.tsx`, replace the local boolean with reading `data-cover-upload-state` from the hook-provided state.
4. Update the button label conditional.
5. Update or extend the e2e if needed — but the existing `[data-cover-upload-state='ready']` wait should still work as-is (state still flips to `ready` at the end).
6. Run unit tests + lint + build.

## Constraints

- The existing e2e wait `[data-cover-upload-state='ready']` MUST still trigger at the same moment.
- The new `preparing` state must NOT block save (the user shouldn't be able to save mid-prep, but if they do, the existing isUploading guard should still prevent save).
- Coordinate with FG_173 — both touch the poster-extraction code path.

## Resources

- Source: `apps/mirror/features/articles/hooks/use-article-cover-video-upload.ts:70-209`
- Source: `apps/mirror/features/articles/components/editor/cover-image-picker.tsx:95-99`
- E2E reference: `apps/mirror/e2e/article-cover-video.authenticated.spec.ts:99-101`
