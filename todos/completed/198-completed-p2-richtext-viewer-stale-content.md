---
status: completed
priority: p2
issue_id: "198"
tags: [code-review, pr-124, editor, tiptap, react]
dependencies: []
---

# RichTextViewer can show stale content after prop updates

## Problem Statement

`RichTextViewer` initializes Tiptap with `useEditor({ content })`, but that `content` value is treated as initial content. When the same component instance receives new `content` props (for example, navigating between detail routes in a shared layout), the rendered document can remain stale.

## Findings

- **Location:** `packages/features/editor/components/rich-text-viewer.tsx:14`
- `useEditor` is initialized without dependency keys and no follow-up `setContent` sync.
- Prop updates can therefore diverge from the displayed ProseMirror document.

## Resolution

Already fixed — duplicate of #185. The `setContent` sync effect (Option A) is present at lines 27–31 of `rich-text-viewer.tsx`:

```tsx
useEffect(() => {
  if (editor && safeContent) {
    editor.commands.setContent(safeContent);
  }
}, [editor, safeContent]);
```

All acceptance criteria are satisfied by the existing implementation.

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-13 | Created from PR #124 review findings | `useEditor` initialization content is not reactive by default |
| 2026-02-13 | Closed as duplicate of #185 | Fix already in place |
