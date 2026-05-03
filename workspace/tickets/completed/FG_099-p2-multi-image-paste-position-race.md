---
id: FG_099
title: "Multi-image paste and drop chain placeholders at distinct document positions"
date: 2026-05-02
type: fix
status: completed
priority: p2
description: "handlePaste and handleDrop in inline-image-upload-plugin sample view.state.selection.from once before the loop, then call startUpload(view, pos, file) for every file with the same stale pos. Each startUpload synchronously dispatches a placeholder at that position, advancing the document — so the second and subsequent placeholders land on top of the first. When uploads resolve, the images all collapse to the same position. Re-read the insertion position after each dispatch."
dependencies: []
parent_plan_id: workspace/spec/2026-04-30-tiptap-inline-image-lifecycle-spec.md
acceptance_criteria:
  - "In packages/features/editor/lib/inline-image-upload-plugin.ts handlePaste and handleDrop, the insertion position is recomputed after each startUpload call (e.g., let insertPos = view.state.selection.from inside the loop)"
  - "New unit test in packages/features/editor/__tests__/inline-image-upload-plugin.test.ts: paste a single ClipboardEvent with 2+ image files via DataTransfer; assert each placeholder's pos is distinct and chained sequentially"
  - "Existing concurrent-uploads test (separate paste calls) continues to pass"
  - "pnpm --filter=@feel-good/features test passes"
  - "pnpm --filter=@feel-good/mirror build passes"
owner_agent: "Editor / frontend race specialist"
---

# Multi-image paste and drop chain placeholders at distinct document positions

## Context

ce:review (`feature-add-editor`, 2026-05-02) Finding #11, julik-frontend-races reviewer at confidence 0.85. Code:

`packages/features/editor/lib/inline-image-upload-plugin.ts:190-198`:

```ts
handlePaste(view, event) {
  const files = collectImageFiles(event.clipboardData);
  if (files.length === 0) return false;
  event.preventDefault();
  const pos = view.state.selection.from;          // sampled ONCE
  for (const file of files) {
    startUpload(view, pos, file, onUpload);       // same pos every iteration
  }
  return true;
},
```

`startUpload` synchronously dispatches a `setMeta(add)` transaction at line 87. The placeholder widget is inserted at `pos`, advancing the document. The next loop iteration reads `pos` (still the original sampled value), not `view.state.selection.from` (which is now `pos + 1`).

Consequence for a 3-image paste: all three placeholders are inserted at the original cursor pos with `side: 1`. Per ProseMirror widget semantics, multiple widgets at the same pos with the same side stack — but when uploads resolve, each `replaceWith(finalPos, finalPos, image)` uses `findPlaceholder` which returns the first match, so the three images collapse to the same position with intervening text shoved aside.

The drop handler at lines 200-214 has the identical bug.

The existing concurrent-uploads test in `inline-image-upload-plugin.test.ts:150-188` fires *separate* `h.paste()` calls — it doesn't exercise the single-paste-with-N-files path.

## Goal

After this ticket, pasting or dropping multiple images at once produces distinct, sequentially-chained placeholders. Each upload resolves into its own position, preserving the user's intent.

## Scope

- `packages/features/editor/lib/inline-image-upload-plugin.ts` `handlePaste` and `handleDrop` — re-sample insertion position per iteration.
- New unit test asserting distinct positions for a single multi-file paste.

## Out of Scope

- Save-while-uploading gate (FG_092 territory).
- Editor unmount safety — already correct.
- Rendering polish for stacked placeholders during the paste→insert window.

## Approach

The simplest fix is reading `view.state.selection.from` after each dispatch, since each `startUpload` synchronously dispatches a transaction that advances the cursor:

```ts
handlePaste(view, event) {
  const files = collectImageFiles(event.clipboardData);
  if (files.length === 0) return false;
  event.preventDefault();
  for (const file of files) {
    const pos = view.state.selection.from;
    startUpload(view, pos, file, onUpload);
  }
  return true;
},
```

Verify that ProseMirror advances the selection past the widget — if not, manually compute the next pos by mapping through the dispatched transaction.

Drop handler: same approach, but the initial `pos` should come from `view.posAtCoords` rather than `selection.from`. Subsequent iterations advance from the previous insertion site.

- **Effort:** Small
- **Risk:** Low — pure plugin internals; covered by new test.

## Implementation Steps

1. Move `const pos = view.state.selection.from;` inside the `for (const file of files)` loop in `handlePaste`.
2. For `handleDrop`: compute initial `pos` from `posAtCoords`, then re-read `view.state.selection.from` (or map through the transaction) after each `startUpload`.
3. Add a test in `packages/features/editor/__tests__/inline-image-upload-plugin.test.ts`: build a `DataTransfer` with two `File` objects, dispatch one `paste` event, assert two placeholders exist at distinct positions.
4. Run `pnpm --filter=@feel-good/features test`.
5. Run `pnpm --filter=@feel-good/mirror build`.

## Constraints

- The plugin must continue to emit a single `event.preventDefault()` for the whole event, not per file.
- Existing single-file paste behavior must not regress.
- The test must use a real `DataTransfer` (or happy-dom equivalent) — not a mocked array of files — so the paste event shape matches production.

## Resources

- ce:review run artifact: `.context/compound-engineering/ce-review/2026-05-02-feature-add-editor/findings.md` Finding #11.
- `packages/features/editor/lib/inline-image-upload-plugin.ts:190-214` — the bug site.
- Spec NFR-05 — concurrent-uploads contract (current test exercises sequential paste calls only).
