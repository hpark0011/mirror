---
status: completed
priority: p2
issue_id: "187"
tags: [code-review, pr-124, editor, layout-shift, ux]
dependencies: []
---

# RichTextViewer returns null causing layout shift

## Problem Statement

`RichTextViewer` returns `null` while the Tiptap editor initializes (`immediatelyRender: false` for SSR safety). This causes a visible layout shift — content area collapses then expands when the editor mounts.

## Findings

- `packages/features/editor/components/rich-text-viewer.tsx` — `if (!editor) return null`
- `immediatelyRender: false` is correct for SSR but means the editor is null for one render cycle

## Proposed Solutions

### Option A: Render a skeleton/placeholder (Recommended)

Return a min-height container or skeleton instead of null while editor initializes.

- Effort: Small
- Risk: Low

### Option B: Use CSS to reserve space

Apply `min-height` on the parent container so the layout doesn't shift.

- Effort: Small
- Risk: Low

## Acceptance Criteria

- [ ] No visible layout shift when article loads
- [ ] Content still renders correctly after editor initializes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-13 | Created from PR #124 code review | immediatelyRender: false + null return = layout shift |
