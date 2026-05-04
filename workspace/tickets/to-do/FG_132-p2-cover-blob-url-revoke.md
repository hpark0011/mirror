---
id: FG_132
title: "Cover-image blob URLs are revoked on replace, clear, and unmount"
date: 2026-05-05
type: fix
status: to-do
priority: p2
description: "Both article form hooks call URL.createObjectURL on cover upload but never call URL.revokeObjectURL, leaking multi-MB blob references for the lifetime of the page."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "`grep -n 'URL.revokeObjectURL' apps/mirror/features/articles/hooks/use-new-article-form.tsx apps/mirror/features/articles/hooks/use-edit-article-form.tsx` returns matches in both files."
  - "Replacing the cover image multiple times in dev does not leak the prior blob URLs (verified via `chrome://blob-internals` or by holding a ref to the prior URL and confirming it's revoked)."
  - "A `useEffect` cleanup in both hooks revokes the active blob URL on unmount."
  - "`pnpm build --filter=@feel-good/mirror` and `pnpm lint --filter=@feel-good/mirror` pass."
owner_agent: "frontend engineer (React)"
---

# Cover-image blob URLs are revoked on replace, clear, and unmount

## Context

Surfaced by the PR #34 code review (`code-review-pr34` batch); also raised by CodeRabbit (PR threads r3180086716 and r3181866553). `apps/mirror/features/articles/hooks/use-new-article-form.tsx:81` and `use-edit-article-form.tsx:89` each call `const objectUrl = URL.createObjectURL(file); setCoverImageUrl(objectUrl);` and store the URL in state without revoking the previous value. `handleCoverImageClear` sets `coverImageUrl` to `null` without revoking, and there is no `useEffect` cleanup on unmount.

Each cover replacement leaks one blob URL backed by the full image file in memory (typically 1-8 MB for a photo). Long edit sessions accumulate; on low-RAM devices the tab can be discarded.

**Risk:** memory leak that can crash the editor tab on constrained devices, losing unsaved article content.

## Goal

Blob URLs created for cover-image previews are revoked when the URL is replaced, cleared, or the component unmounts.

## Scope

- Track the previous blob URL in a `useRef` (or equivalent) in both hooks.
- Revoke before assigning a new URL in `handleCoverImageUpload`.
- Revoke when clearing in `handleCoverImageClear`.
- Add a `useEffect` cleanup on unmount.

## Out of Scope

- Changing the upload pipeline.
- Inline-image blob handling (separate surface).

## Approach

Mirror the pattern in `cover-image-picker.tsx` (which already revokes on success). Use the functional updater form of `setCoverImageUrl` to read the previous value, revoke it if it starts with `blob:`, then return the new value.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. In `use-new-article-form.tsx:78-87`, change `setCoverImageUrl(objectUrl)` to use the functional updater that revokes the previous blob URL if it starts with `blob:`.
2. In `handleCoverImageClear` (lines 89-92), do the same — revoke before setting to `null`.
3. Add a `useEffect(() => () => { if (coverImageUrl?.startsWith('blob:')) URL.revokeObjectURL(coverImageUrl); }, [])` to the hook.
4. Repeat steps 1-3 in `use-edit-article-form.tsx`.
5. Manually verify in dev: replace the cover three times, confirm only the most recent blob URL is live.

## Constraints

- Must not revoke the URL while it's still bound to the visible `<img>` element — revoke happens at the moment of replace/clear, after React has the new state.
- Do not revoke non-blob URLs (server URLs from a successful upload).

## Resources

- PR #34: https://github.com/hpark0011/mirror/pull/34
- CodeRabbit threads: r3180086716, r3181866553
