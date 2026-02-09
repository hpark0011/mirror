---
status: completed
priority: p1
issue_id: "094"
tags: [code-review, race-condition, ux, mirror]
dependencies: []
---

# Dual Transform Ownership Causes Transition Cancellation in Bottom Sheet

## Problem Statement

`useBottomSheet` applies transforms both imperatively (via `applyTransform` writing to `element.style.transform` and `element.style.transition`) and declaratively (via React inline `style` props in `MobileProfileLayout` and `SheetContainer`). When `snapTo()` fires, it calls `applyTransform(target, true)` which sets a 300ms CSS transition, then `setProgress(target)` enqueues a React re-render. When React reconciles, it overwrites the `style` object without the `transition` property, cancelling the in-flight animation mid-frame. The sheet teleports instead of easing.

The same conflict affects the background element (`bgScale`) and the `SheetContainer` CSS class `transition-transform` which conflicts with imperative `style.transition = "none"`.

## Findings

- **Source:** julik-frontend-races-reviewer, pattern-recognition-specialist, performance-oracle agents
- **Location:** `apps/mirror/app/(protected)/dashboard/_hooks/use-bottom-sheet.ts` lines 52-80 (applyTransform), 82-101 (snapTo); `_views/mobile-profile-layout.tsx` lines 29, 40; `_components/sheet-container.tsx` line 24
- **Evidence:** `setProgress` and `applyTransform` called in same block (lines 85-88). React re-render overwrites imperative transition.

## Proposed Solutions

### Option A: Fully imperative transforms (Recommended)
- Remove inline `style={{ transform: ... }}` from `MobileProfileLayout` and `SheetContainer`
- Let `applyTransform` be the sole author of transforms on sheet and background
- Remove `bgScale` from hook return value
- Remove CSS `transition-transform` class from `SheetContainer`
- **Effort:** Medium
- **Risk:** Low

### Option B: Replace with vaul Drawer
- Replace hand-rolled gesture system with `vaul` (already in shadcn/ui ecosystem)
- Eliminates ~280 lines across 3 files
- **Effort:** Large
- **Risk:** Medium (behavior differences)

## Acceptance Criteria

- [ ] Only one source of truth for sheet and background transforms
- [ ] Snap animation plays smoothly (no stutter/teleport)
- [ ] No CSS class / imperative style conflict
- [ ] Verified on throttled CPU in DevTools

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-09 | Created from PR #105 round 2 review | Never mix imperative DOM writes with React inline styles on same element |

## Resources

- PR: https://github.com/hpark0011/feel-good/pull/105
