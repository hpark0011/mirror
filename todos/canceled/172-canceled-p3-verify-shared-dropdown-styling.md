---
status: canceled
priority: p3
issue_id: "172"
tags: [code-review, ui, design-system]
dependencies: []
---

# Verify Shared Dropdown Menu Styling Changes Across All Consumer Apps

## Problem Statement

PR #120 makes significant styling changes to `packages/ui/src/primitives/dropdown-menu.tsx` — height, font size, border radius, focus colors, separator styling, checkbox rendering, and sub-trigger icon. These affect all consumers (greyboard, ui-factory, mirror). Visual regression should be verified.

## Findings

- **Location:** `packages/ui/src/primitives/dropdown-menu.tsx`
- Changes: `h-7→h-6`, `text-sm→text-[13px]`, `rounded-md→rounded-[8px]`, `bg-accent→bg-popover-focus`, CheckIcon→Checkbox, ChevronRight→ArrowTriangleRightFill, separator styling

## Proposed Solutions

Manually verify dropdown menus in greyboard and ui-factory still look correct after these changes. Check both light and dark modes.

- **Effort:** Small

## Acceptance Criteria

- [ ] Greyboard dropdown menus render correctly in light and dark mode
- [ ] UI Factory dropdown showcase renders correctly
- [ ] No visual regressions in existing dropdown usage

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-12 | Created from PR #120 code review | |
