---
id: FG_186
title: "Picker must reflect parent hook's in-flight status to block concurrent uploads"
date: 2026-05-08
type: fix
status: completed
priority: p2
description: "The picker's disabled={isUploading} is local state; the parent hook's handleCoverUpload has no mutex. Concurrent invocation (test harness, second tab, React StrictMode) revokes A's blob URL while A's video src= still renders it — Firefox surfaces broken-blob errors."
dependencies: ["FG_185"]
parent_plan_id: PLAN_010
acceptance_criteria:
  - "Either: parent hook returns `isUploadingCover` boolean and picker reads it as `disabled={isUploadingCover || isUploading}`, OR parent hook installs a ref-guarded lock that rejects concurrent handleCoverUpload calls with a clear error"
  - "A vitest test simulates two concurrent handleCoverUpload calls and asserts the second is rejected (or the first's blob URL is not revoked)"
  - "`pnpm --filter=@feel-good/mirror test:unit -- use-edit-article-form use-new-article-form` passes"
  - "`pnpm --filter=@feel-good/mirror lint` exits 0"
owner_agent: "React Hooks Engineer"
---

# Picker Must Reflect Parent Hook's In-Flight Status to Block Concurrent Uploads

## Context

In `cover-image-picker.tsx`, the file input and Replace/Remove buttons are disabled while `isUploading === true` (lines 112, 151, 164, 177). `isUploading` is local picker state, set by `handleSelect`.

The parent hooks `useEditArticleForm` and `useNewArticleForm` expose `handleCoverUpload` but do NOT have any in-flight guard. Concurrent calls from outside the picker bypass the picker's local `disabled` flag:

- Test harness directly invoking `handleCoverUpload` twice in `act(...)`
- A second browser tab triggering form setters via real-time sync
- React StrictMode double-invoking effects in dev
- Future code that wires the picker to drag-and-drop OR keyboard shortcuts that bypass the click-disabled state

When two `handleCoverUpload` calls overlap, the second one's `setCoverVideoUrl((prev) => { if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev); return newUrl; })` revokes the first one's URL while the first's `<video>` element still references it. Firefox surfaces a broken-blob error; Chrome silently shows a black frame.

- **Source:** Code review of PLAN_010 article-cover-video branch
- **Location:** `apps/mirror/features/articles/components/editor/cover-image-picker.tsx:70-89` + the two hook files
- **Evidence:** Local-only `isUploading` flag; no parent-side mutex.

## Goal

Concurrent `handleCoverUpload` invocations are either prevented or fail loudly. The picker's disabled state reflects the actual in-flight status of the parent hook.

## Scope

- Hoist an `isUploadingCover` boolean (or equivalent) into the parent hook's return value.
- Picker reads it and OR's into its existing `isUploading` for the `disabled` prop.
- Optional: also install a ref-guarded lock in `handleCoverUpload` to early-return on re-entry.

## Out of Scope

- Refactoring `useEditArticleForm` / `useNewArticleForm` to share a common base hook.
- Rate-limiting uploads server-side.

## Approach

Two complementary mechanisms:

**1. Hook-level state for picker:**
```ts
// In useEditArticleForm:
const [isUploadingCover, setIsUploadingCover] = useState(false);
const handleCoverUpload = useCallback(async (file: File) => {
  setIsUploadingCover(true);
  try {
    if (file.type.startsWith("video/")) {
      // …
    } else {
      // …
    }
  } finally {
    setIsUploadingCover(false);
  }
}, [...]);
return { …, isUploadingCover, handleCoverUpload };
```

**2. Ref-guarded lock as belt-and-suspenders:**
```ts
const uploadInFlightRef = useRef(false);
const handleCoverUpload = useCallback(async (file: File) => {
  if (uploadInFlightRef.current) {
    throw new Error("A cover upload is already in progress");
  }
  uploadInFlightRef.current = true;
  try { … } finally { uploadInFlightRef.current = false; }
}, [...]);
```

The ref-guard is robust against React StrictMode double-invokes; the state is visible to the picker.

- **Effort:** Medium
- **Risk:** Low (additive — does not remove the existing local `isUploading`)

## Implementation Steps

1. In `useEditArticleForm` and `useNewArticleForm`, add `isUploadingCover` state + ref-guarded lock pattern in `handleCoverUpload`.
2. Return `isUploadingCover` from both hooks.
3. Update `ArticleEditorShell` and downstream components to thread `isUploadingCover` to the picker.
4. In `cover-image-picker.tsx`, accept an optional `isUploading` prop from the parent and OR it into the local state for the `disabled` calculation.
5. Add vitest tests for both hooks: simulate concurrent `handleCoverUpload` calls, assert the second throws.
6. Run unit tests + lint + build.

## Constraints

- Don't remove the picker's local `isUploading` — it still owns the local UI state for non-parent-driven uploads (drag/drop, paste).
- The thrown error from a re-entry must propagate cleanly through the editor's existing toast handler.

## Resources

- Source: `apps/mirror/features/articles/hooks/use-edit-article-form.tsx:111-163`
- Source: `apps/mirror/features/articles/components/editor/cover-image-picker.tsx`
