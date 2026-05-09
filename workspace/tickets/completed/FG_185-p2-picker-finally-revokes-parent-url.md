---
id: FG_185
title: "Cover-image-picker must hand off its temporary preview URL after upload"
date: 2026-05-08
type: fix
status: completed
priority: p2
description: "The picker creates a temporary objectUrl for immediate preview and the parent hook creates its own post-upload objectUrl. The old effect preserved any blob preview forever while the picker's finally revoked the temporary URL, so the preview could hold a stale/broken blob instead of handing off to parent state."
dependencies: []
parent_plan_id: PLAN_010
acceptance_criteria:
  - "`CoverImagePicker` tracks its own temporary preview URL and has no unconditional revoke in the upload success/finally path"
  - "After successful upload, the picker re-syncs from parent props, revokes the temporary picker URL, and does not revoke the parent-owned URL"
  - "A vitest test mounts the picker, simulates a successful video upload, and asserts the preview `src` hands off to the parent-owned URL"
  - "`pnpm --filter=@feel-good/mirror test:e2e -- article-cover-video`, `pnpm --filter=@feel-good/mirror lint`, and `pnpm --filter=@feel-good/mirror build` exit 0"
owner_agent: "React Hooks Engineer"
---

# Cover-Image-Picker Finally-Block Must Not Revoke the URL the Parent Now Stores

## Context

In `cover-image-picker.tsx:70-89`:

```ts
const handleSelect = async (file: File) => {
  setIsUploading(true);
  …
  const objectUrl = URL.createObjectURL(file);
  setActive(/* uses objectUrl */);
  try {
    await onUpload(file);
    setHasUploaded(true);
  } finally {
    URL.revokeObjectURL(objectUrl);  // ← line 87
    setIsUploading(false);
  }
};
```

`onUpload` is the parent's `handleCoverUpload`. The parent stores `objectUrl` in two places:
- `coverVideoUrl` state (visible to the rest of the editor and to the parent props pipeline)
- `blobUrlRef.current` for unmount cleanup

After the upload resolves, the picker's finally revokes `objectUrl`. The parent's state still holds it. The parent's `blobUrlRef` still points at it. Any subsequent re-render reads a revoked URL until the reactive query tick replaces it with the server URL.

Symptoms:
- Direct reads of `coverVideoUrl` (analytics, SSR re-mount, copy-link) get a dead URL
- Firefox in particular surfaces broken-blob console errors
- The picker preserves the blob URL via its useEffect guard, but the parent state is the source of truth for everything outside the picker

The picker's finally was correct when it owned the URL. Now that the parent consumed it, the parent is responsible for revoke (via `clearCoverState` + `blobUrlRef` cleanup).

- **Source:** Code review of PLAN_010 article-cover-video branch
- **Location:** `apps/mirror/features/articles/components/editor/cover-image-picker.tsx:82-89`
- **Evidence:** Picker creates URL, parent copies it, picker revokes it before parent's lifecycle ends.

## Goal

Blob URL revocation is owned exclusively by the parent hook. The picker creates the URL but does not revoke it.

## Scope

- Remove the `URL.revokeObjectURL(objectUrl)` call from the picker's `finally` block.
- Confirm the parent hook's `clearCoverState` and `blobUrlRef` unmount cleanup cover all revoke paths.

## Out of Scope

- Hoisting `isUploading` into the parent (FG_186).
- Hooking blob URL creation into the parent in the first place.

## Approach

Drop the picker-side revoke. The parent hook already revokes via:
- `clearCoverState` (called on Remove and on create-failure orphan cleanup)
- `blobUrlRef` unmount cleanup
- `setCoverVideoUrl((prev) => { if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev); return objectUrl; })` — replaces revokes the prior URL on each new upload

There is one path the parent doesn't cover: the case where `onUpload` REJECTS (validation error). In that case, the parent never stores `objectUrl` so the picker's local `setActive(objectUrl)` is the only reference. We need to revoke in that specific case.

Updated picker logic:
```ts
try {
  await onUpload(file);
  setHasUploaded(true);
  // Do NOT revoke — parent now owns the URL.
} catch (err) {
  // Upload rejected — parent never stored the URL. Revoke locally.
  URL.revokeObjectURL(objectUrl);
  throw err;
} finally {
  setIsUploading(false);
}
```

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. In `apps/mirror/features/articles/components/editor/cover-image-picker.tsx:82-89`, replace the finally block with the try/catch shape above.
2. Add a vitest test asserting URL.revokeObjectURL is NOT called by the picker on successful upload.
3. Add a sibling vitest test asserting URL.revokeObjectURL IS called when onUpload rejects.
4. Manual Chrome MCP verification: upload video cover, save, navigate away and back, confirm no broken-URL console errors.
5. Run `pnpm --filter=@feel-good/mirror lint && pnpm --filter=@feel-good/mirror build`.

## Constraints

- The parent hook's revoke paths must remain intact — verify `setCoverVideoUrl` still revokes `prev` when assigning a new value.
- If `onUpload` resolves but the parent throws synchronously after, we still leak — but that is a fundamental React lifecycle issue and is rare enough to defer.

## Resources

- Source: `apps/mirror/features/articles/components/editor/cover-image-picker.tsx:70-89`
- Parent revoke paths: `apps/mirror/features/articles/hooks/use-edit-article-form.tsx:111-185` and `use-new-article-form.tsx:128-180`

## Resolution

Completed on 2026-05-09.

- Correction to the original ticket analysis: the parent does not copy the
  picker's exact `objectUrl`; it creates its own post-upload `objectUrl`. The
  right boundary is therefore "picker owns and revokes the temporary preview
  URL, parent owns and revokes the committed preview URL."
- `CoverImagePicker` now treats its own `blob:` URL as a temporary upload
  preview only. While upload is in flight, it preserves the preview; once
  upload settles, it re-syncs from parent props and revokes the temporary URL
  after the parent-owned URL takes over.
- Added
  `apps/mirror/features/articles/components/editor/__tests__/cover-image-picker.test.tsx`
  to assert a successful video upload hands off from the temporary picker URL to
  the parent-owned URL and does not revoke the parent URL.
- Verified with `pnpm --filter=@feel-good/mirror test:unit -- cover-image-picker`,
  `pnpm lint --filter=@feel-good/mirror`,
  `pnpm --filter=@feel-good/mirror test:e2e -- article-cover-video`, and
  `pnpm build --filter=@feel-good/mirror`.
