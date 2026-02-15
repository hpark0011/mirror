---
status: completed
priority: p1
issue_id: "185"
tags: [code-review, pr-124, editor, tiptap, react]
dependencies: []
---

# RichTextViewer doesn't update on content prop change

## Problem Statement

`RichTextViewer` passes `content` to `useEditor()` which only uses it as the initial value. If a parent re-renders with different `content` (e.g., navigating between articles in a shared layout), the viewer will show stale content from the first render.

## Findings

- `packages/features/editor/components/rich-text-viewer.tsx` — `useEditor({ content })` sets content once on mount
- Tiptap's `useEditor` treats `content` as an initial value, not a reactive prop
- In mirror's article detail route, navigating between articles may reuse the same component instance

## Proposed Solutions

### Option A: useEffect to sync content (Recommended)

Add a `useEffect` that calls `editor.commands.setContent(content)` when the `content` prop changes.

```tsx
useEffect(() => {
  if (editor && content) {
    editor.commands.setContent(content);
  }
}, [editor, content]);
```

- Effort: Small
- Risk: Low

### Option B: Key the component

Have the parent pass a `key` prop (e.g., article slug) to force remount. Simpler but less efficient.

- Effort: Small
- Risk: Low (but causes full remount)

## Acceptance Criteria

- [ ] Navigating between articles updates displayed content
- [ ] No stale content when content prop changes
- [ ] Editor doesn't unnecessarily re-initialize

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-13 | Created from PR #124 code review | Tiptap useEditor content is initial-only, not reactive |
