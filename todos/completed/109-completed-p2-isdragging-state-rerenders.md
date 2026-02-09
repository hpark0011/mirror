---
status: completed
priority: p2
issue_id: "109"
tags: [code-review, performance, mirror, profile]
dependencies: []
---

# isDragging React State Causes 2 Unnecessary Re-renders Per Gesture

## Problem Statement

`isDragging` is held as React state (`useState`) in `use-bottom-sheet.ts:37`, but it's only read in event handlers (pointer move/up), never in render output. Setting it to `true` on pointer-down and `false` on pointer-up triggers 2 unnecessary component re-renders per gesture cycle.

## Findings

- **Source:** performance-oracle, code-simplicity-reviewer agents
- **Locations:**
  - `apps/mirror/features/profile/hooks/use-bottom-sheet.ts` lines 37, 111, 145

## Proposed Solutions

### Option A: Replace with useRef (Recommended)
Change `isDragging` from `useState` to `useRef` since its value is only consumed inside event handlers, not during rendering.
```typescript
const isDraggingRef = useRef(false);
```
- **Effort:** Low
- **Risk:** None — value is never rendered

## Acceptance Criteria

- [x] `isDragging` converted from `useState` to `useRef`
- [x] Zero React re-renders during gesture drag cycle
- [x] Gesture behavior unchanged

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-09 | Created from PR #106 review | Use useRef for values only read in event handlers |
| 2026-02-09 | Completed | `isDragging` was also used in render (SheetContainer CSS class toggle), but `applyTransform` already manages transitions via inline styles making the CSS class redundant. Converted to ref + set `style.transition = "none"` directly in handlePointerDown. Removed `isDragging` prop from SheetContainer. |

## Resources

- PR: https://github.com/hpark0011/feel-good/pull/106
