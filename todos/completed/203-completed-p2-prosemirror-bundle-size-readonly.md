---
status: completed
priority: p2
issue_id: "203"
tags: [code-review, pr-124, performance, bundle-size, editor, tiptap]
dependencies: []
---

# Full ProseMirror bundle loaded for read-only viewer

## Problem Statement

`RichTextViewer` loads the full Tiptap/ProseMirror stack (~80-120KB gzipped) even though the component is read-only (`editable: false`). For a blogging platform where most visitors are readers (not editors), this is a significant bundle cost that impacts page load performance.

## Resolution

Implemented **Option A: Dynamic import with next/dynamic**.

`RichTextViewer` is now lazily loaded in `article-detail-view.tsx` via `next/dynamic` with `ssr: false`. The full ProseMirror bundle is no longer part of the initial page render — it loads asynchronously after the article header (title, date, category) has painted.

A minimal placeholder (`prose dark:prose-invert max-w-none min-h-[200px]`) renders during load, matching the viewer's own empty-state styling to minimize layout shift.

### Changes

- `apps/mirror/features/articles/views/article-detail-view.tsx` — replaced static import with `next/dynamic` lazy import

## Acceptance Criteria

- [x] Article detail page does not load ProseMirror on initial page render (loads lazily)
- [x] Visual rendering of articles is unchanged (same component, same props)
- [x] Build passes cleanly

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-13 | Created from PR #124 performance review | Full ProseMirror is ~80-120KB gzipped — heavy for read-only content |
| 2026-02-15 | Implemented Option A (dynamic import) | `ssr: false` + loading placeholder is a one-line win for heavy client-only components |
