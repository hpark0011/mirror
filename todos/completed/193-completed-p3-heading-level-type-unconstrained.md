---
status: completed
priority: p3
issue_id: "193"
tags: [code-review, pr-124, types, mock-data]
dependencies: []
---

# heading() helper accepts unconstrained number type

## Problem Statement

The `heading()` helper in mock-articles.ts accepts `level: number` but StarterKit is configured with `levels: [2, 3, 4]`. Passing `level: 1` or `level: 5` would create content that Tiptap silently ignores or renders incorrectly.

## Findings

- `apps/mirror/features/articles/lib/mock-articles.ts` — `function heading(level: number, ...)`
- `packages/features/editor/lib/extensions.ts` — `heading: { levels: [2, 3, 4] }`

## Proposed Solutions

Constrain the type to `level: 2 | 3 | 4` in the heading helper.

- Effort: Small
- Risk: Low

## Acceptance Criteria

- [ ] heading() only accepts valid levels (2, 3, 4)
- [ ] TypeScript catches invalid heading levels at compile time

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-13 | Created from PR #124 code review | Match mock data helpers to actual extension config |
