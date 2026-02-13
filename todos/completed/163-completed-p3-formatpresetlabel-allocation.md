---
status: completed
priority: p3
issue_id: "163"
tags: [code-review, performance, mirror]
dependencies: []
---

# formatPresetLabel Allocates New Object on Every Call

## Problem Statement

`formatPresetLabel` in `article-filter-dropdown.tsx` creates a new `Record<DatePreset, string>` on every call. Move to a module-level constant and inline the lookup.

## Findings

- **Location:** `apps/mirror/features/articles/components/article-filter-dropdown.tsx:42-50`

## Proposed Solutions

Move to module-level constant: `const DATE_PRESET_LABELS: Record<DatePreset, string> = { ... }`. Replace function calls with `DATE_PRESET_LABELS[preset]`.

- **Effort:** Trivial

## Acceptance Criteria

- [ ] No per-call object allocation for preset labels

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-12 | Created from PR #120 code review | |
