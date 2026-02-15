---
status: completed
priority: p3
issue_id: "197"
tags: [code-review, pr-124, css, cleanup]
dependencies: []
---

# CSS token overrides for unused prose elements

## Problem Statement

`tiptap-content.css` maps `--tw-prose-*` variables for elements not currently used in the editor (lead, captions, table borders). This adds unused CSS and could be misleading about what the editor supports.

## Findings

- `packages/features/editor/styles/tiptap-content.css` — includes overrides for:
  - `--tw-prose-lead` (no lead content in articles)
  - `--tw-prose-captions` (no figure captions)
  - `--tw-prose-th-borders`, `--tw-prose-td-borders` (no tables in StarterKit config)

## Proposed Solutions

Remove unused token mappings and add them when the corresponding extensions are enabled. Comment the remaining ones to explain which elements they affect.

- Effort: Small
- Risk: Low

## Acceptance Criteria

- [ ] Only token overrides for active extensions remain
- [ ] No visual changes to current content

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-13 | Created from PR #124 code review | Keep CSS in sync with actual extension configuration |
