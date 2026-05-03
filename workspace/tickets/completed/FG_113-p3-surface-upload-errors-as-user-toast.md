---
id: FG_113
title: "Inline-image upload failures surface to the user via toast or inline error"
date: 2026-05-02
type: improvement
status: completed
priority: p3
description: "When the inline-image upload plugin's onUpload rejects, the only feedback is console.error. The placeholder vanishes silently — the user may not notice the upload failed and proceed to save the article with a missing image. Add an onError callback to the plugin (or wrap the upload hooks to toast on failure) so the user sees a clear, actionable error."
dependencies: []
parent_plan_id: workspace/spec/2026-04-30-tiptap-inline-image-lifecycle-spec.md
acceptance_criteria:
  - "Either: createInlineImageUploadPlugin accepts an onError?: (err: unknown) => void option and calls it on upload failure; OR the upload hooks wrap their returned upload function to toast on failure before re-throwing"
  - "ArticleEditor and PostEditor wire the chosen mechanism to a toast (using the existing sonner / toast helper)"
  - "On upload failure (e.g., 5xx from Convex storage), the user sees a visible error message — not just a vanished placeholder"
  - "Existing inline-image-upload-plugin tests still pass"
  - "pnpm --filter=@feel-good/mirror build passes"
  - "Manual: paste an image, simulate upload failure (e.g., disconnect network), confirm toast appears"
owner_agent: "Editor / UX specialist"
---

# Inline-image upload failures surface to the user via toast or inline error

## Context

ce:review (`feature-add-editor`, 2026-05-02) Finding #36, reliability reviewer at confidence 0.80.

`packages/features/editor/lib/inline-image-upload-plugin.ts:121`:

```ts
(error) => {
  console.error("[inline-image-upload-plugin] upload failed", error);
  if (!view.dom.isConnected) return;
  view.dispatch(
    view.state.tr.setMeta(inlineImageUploadPluginKey, {
      remove: { id },
    }),
  );
}
```

The placeholder is silently removed; only console.error remains. No toast, no inline error chip, no retry affordance. The hook closure (e.g., `useArticleInlineImageUpload`'s `upload` function) throws on failure but neither `useArticleInlineImageUpload` nor `usePostInlineImageUpload` wraps the call in a catch+toast.

User flow with this bug:

1. User pastes a valid image. Placeholder appears.
2. Network drops. Convex upload returns 502.
3. Placeholder vanishes. No notification.
4. User keeps typing. Saves the article. Saved body has no image where the user intended.

## Goal

After this ticket, the user sees a visible error (toast or inline) when an inline-image upload fails. The user can retry by pasting again or notice the missing image immediately rather than after save.

## Scope

- `packages/features/editor/lib/inline-image-upload-plugin.ts` — accept optional `onError` callback in `InlineImageUploadOptions`.
- `packages/features/editor/components/rich-text-editor.tsx` — accept optional `onImageUploadError` prop, plumb to plugin.
- `apps/mirror/features/articles/components/article-editor.tsx` and `post-editor.tsx` — wire to toast.
- Same toast helper as elsewhere in the app (likely Sonner or shadcn toast).

## Out of Scope

- Retry / undo affordance — silent error + toast is enough for v1.
- Inline error chip rendered at the placeholder position (more invasive).
- Distinguishing validation errors (FG_106's `InlineImageValidationError`) from network errors in the toast — both can show the same kind of message.

## Approach

Add the callback to the plugin options (cleaner than wrapping the hook):

```ts
export type InlineImageUploadOptions = {
  onUpload: (file: File) => Promise<InlineImageUploadResult>;
  onError?: (err: unknown) => void;
};

// in startUpload's reject handler:
(error) => {
  console.error("[inline-image-upload-plugin] upload failed", error);
  options.onError?.(error);
  if (!view.dom.isConnected) return;
  view.dispatch(...);
}
```

Plumb through `RichTextEditor`:

```ts
type RichTextEditorProps = {
  ...
  onImageUploadError?: (err: unknown) => void;
};

// in extensions useMemo:
createInlineImageUploadExtension({
  onUpload: (file) => onImageUploadRef.current(file),
  onError: (err) => onImageUploadErrorRef.current?.(err),
}),
```

Article/Post editor:

```ts
const handleUploadError = useCallback((err: unknown) => {
  const message =
    err instanceof InlineImageValidationError
      ? err.message
      : "Image upload failed. Please try again.";
  toast.error(message);
}, []);

<RichTextEditor onImageUploadError={handleUploadError} ... />
```

- **Effort:** Small
- **Risk:** Low — additive option; default behavior unchanged.

## Implementation Steps

1. Add `onError?` to `InlineImageUploadOptions` in `inline-image-upload-plugin.ts` and call it in the reject handler.
2. Add `onImageUploadError?` to `RichTextEditorProps` and ref-forward similar to `onImageUpload`.
3. Wire toast in `article-editor.tsx` and `post-editor.tsx` (or in the shared shell from FG_107).
4. Add Vitest case in `inline-image-upload-plugin.test.ts` asserting `onError` fires when upload rejects.
5. Run all tests; manual verify with a forced failure.

## Constraints

- Toast helper must match existing app conventions.
- Validation errors (FG_106) vs network errors should both surface, but with appropriate copy.
- Do not block subsequent paste/upload attempts — toast and continue.

## Resources

- ce:review run artifact: `.context/compound-engineering/ce-review/2026-05-02-feature-add-editor/findings.md` Finding #36.
- `packages/features/editor/lib/inline-image-upload-plugin.ts:121-132`.
- Existing toast usage in mirror — search for `import { toast }` to find the helper.
