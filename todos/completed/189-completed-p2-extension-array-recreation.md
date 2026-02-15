---
status: completed
priority: p2
issue_id: "189"
tags: [code-review, pr-124, editor, tiptap, performance]
dependencies: []
---

# createArticleExtensions() recreated on every render

## Problem Statement

`createArticleExtensions()` is called inline inside `RichTextViewer` without memoization. Each render creates a new extensions array, which Tiptap may use to detect configuration changes and reinitialize the editor.

## Findings

- `packages/features/editor/components/rich-text-viewer.tsx` — `extensions: createArticleExtensions()` inside `useEditor()`
- `packages/features/editor/lib/extensions.ts` — returns a new array on every call
- Tiptap's `useEditor` does shallow comparison on the options object

## Proposed Solutions

### Option A: Module-level constant (Recommended)

Create extensions once at module scope since the configuration is static:

```ts
const ARTICLE_EXTENSIONS = createArticleExtensions();
```

Then reference `ARTICLE_EXTENSIONS` in useEditor.

- Effort: Small
- Risk: Low

### Option B: useMemo

Wrap in `useMemo(() => createArticleExtensions(), [])`.

- Effort: Small
- Risk: Low

## Acceptance Criteria

- [ ] Extensions array is created once, not per render
- [ ] Editor doesn't reinitialize unnecessarily

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-13 | Created from PR #124 code review | Static config should be hoisted to module scope |
