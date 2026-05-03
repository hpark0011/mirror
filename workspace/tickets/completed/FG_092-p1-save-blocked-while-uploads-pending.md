---
id: FG_092
title: "Save button is disabled while inline-image uploads are still pending"
date: 2026-05-02
type: fix
status: completed
priority: p1
description: "ArticleEditor and PostEditor capture editor body via onChange on every keystroke. While an inline image is uploading the placeholder is a Decoration widget — not a real ProseMirror node — so editor.getJSON() returns a body with a gap where the image should be. If the user clicks Save during the upload window, the saved JSON loses the image even though the upload may succeed seconds later into a now-dead editor. The plugin already exposes its DecorationSet via inlineImageUploadPluginKey; gate Save on that being empty."
dependencies: []
parent_plan_id: workspace/spec/2026-04-30-tiptap-inline-image-lifecycle-spec.md
acceptance_criteria:
  - "grep -n 'inlineImageUploadPluginKey' apps/mirror/features/articles/components/article-editor.tsx returns at least 1 match (state introspection or pending-uploads hook)"
  - "Same grep on apps/mirror/features/posts/components/post-editor.tsx returns at least 1 match"
  - "New unit test in packages/features/editor/__tests__/inline-image-upload-plugin.test.ts: insert placeholder, assert hasPendingUploads(state) returns true; replace placeholder with image node, assert returns false"
  - "Manual verification: paste an image, click Save before upload completes — image is preserved (Save button was disabled or save deferred)"
  - "pnpm --filter=@feel-good/mirror build passes"
  - "Existing inline-image-upload-plugin tests still pass"
owner_agent: "Editor / frontend race specialist"
---

# Save button is disabled while inline-image uploads are still pending

## Context

ce:review (`feature-add-editor`, 2026-05-02) Finding #2, julik-frontend-races at confidence 0.88. Failure mode:

1. User pastes an image. `inline-image-upload-plugin.ts` inserts a `Decoration.widget` placeholder at the current selection and starts the async `onUpload(file)` chain.
2. Editor's `onUpdate` fires (the placeholder transaction was a `setMeta`, but ProseMirror still calls update). `RichTextEditor` calls `onChangeRef.current(instance.getJSON())` — but `getJSON()` only serializes real nodes, NOT widget decorations.
3. User clicks Save before `onUpload` resolves. `ArticleEditor.handleSave` (`apps/mirror/features/articles/components/article-editor.tsx:43`) reads `body` state and dispatches `api.articles.mutations.update` with a body that contains no image at the placeholder position.
4. Upload completes seconds later. `view.dom.isConnected` may still be true, so the plugin dispatches `replaceWith(finalPos, finalPos, image)` — but this transaction's onUpdate fires AFTER save committed, into local state only. Image is permanently absent from the saved body even though the user thinks they saved it.

The plugin already stores its `DecorationSet` in plugin state under `inlineImageUploadPluginKey`. A `hasPendingUploads(state)` helper that returns `inlineImageUploadPluginKey.getState(state)?.find().length > 0` cleanly exposes this to the editor host.

## Goal

After this ticket, clicking Save while any inline-image upload is in flight either disables the Save button (preferred) or surfaces a "wait for uploads" message, and the saved body preserves all completed and pending images.

## Scope

- `packages/features/editor/lib/inline-image-upload-plugin.ts` — export `hasPendingUploads(state)` helper.
- `packages/features/editor/components/rich-text-editor.tsx` — propagate pending-uploads state via callback or imperative ref.
- `apps/mirror/features/articles/components/article-editor.tsx` — disable Save when pending uploads exist.
- `apps/mirror/features/posts/components/post-editor.tsx` — same.
- Vitest case in `packages/features/editor/__tests__/inline-image-upload-plugin.test.ts`.

## Out of Scope

- Auto-saving / draft autosave during pending uploads — explicitly out of scope per spec.
- Showing a global "uploading..." progress indicator in the toolbar — separate UX ticket.
- Save-button label change ("Saving images...") — implementation detail; just disabled is fine.

## Approach

Prefer the propagation-via-callback approach: `RichTextEditor` accepts an optional `onPendingUploadsChange?: (hasPending: boolean) => void`. The plugin's `apply` reducer (already running on every transaction) emits a meta event when the placeholder count changes, the editor subscribes via a `view.props` watcher, and bubbles the boolean up.

Imperative-ref alternative: expose `editorRef.current.hasPendingUploads()`. Less idiomatic for React but smaller surface change.

- **Effort:** Small
- **Risk:** Low — additive prop, no behavior change for callers that don't pass it.

## Implementation Steps

1. In `packages/features/editor/lib/inline-image-upload-plugin.ts`, export `export function hasPendingUploads(state: EditorState): boolean { return (inlineImageUploadPluginKey.getState(state)?.find().length ?? 0) > 0; }`.
2. In `packages/features/editor/components/rich-text-editor.tsx`, accept `onPendingUploadsChange` prop and wire it through editor's `onTransaction` callback to fire on changes (compare prev/next via ref to dedupe).
3. In `apps/mirror/features/articles/components/article-editor.tsx`, hold `pendingUploads` in `useState`, pass `onPendingUploadsChange` to `RichTextEditor`, add `pendingUploads` to the Save button's `disabled` predicate.
4. Mirror the change in `apps/mirror/features/posts/components/post-editor.tsx`.
5. Add Vitest case in `packages/features/editor/__tests__/inline-image-upload-plugin.test.ts` asserting `hasPendingUploads` returns true while a placeholder is live and false after replacement.
6. Run `pnpm --filter=@feel-good/mirror build` and verify the editor pages render.
7. Manually paste an image with throttled network; confirm Save button is disabled until upload completes.

## Constraints

- The helper must NOT expose plugin internals to consumers — return a boolean only.
- Save button should not flash-disable for placeholders that resolve in <100ms — debouncing is acceptable but not required.
- This change does NOT fix the cross-user-deletion issue (FG_091); they are independent gates.

## Resources

- ce:review run artifact: `.context/compound-engineering/ce-review/2026-05-02-feature-add-editor/findings.md` Finding #2.
- `packages/features/editor/lib/inline-image-upload-plugin.ts:49-57` — `findPlaceholder` helper (template for the new exported helper).
- Spec NFR-05 — concurrent uploads + unmount safety contract.
