---
status: completed
priority: p2
issue_id: "120"
tags: [code-review, ui-primitives, functional-correctness]
dependencies: []
---

# DrawerOverlay captures pointer events when invisible in non-modal mode

## Problem Statement

`DrawerContent` unconditionally renders `<DrawerOverlay />` inside its portal (line 55 of `drawer.tsx`). For non-modal, always-open drawers at the "80px" peek snap point, vaul hides the overlay with `opacity: 0` via its injected CSS rule. However, the overlay element at `position: fixed; inset: 0; z-50` still captures pointer events on page content behind it.

This is a functional correctness issue — users may attempt to interact with page content and nothing responds because an invisible overlay intercepts clicks.

## Findings

- Performance Oracle agent identified this as the primary functional concern
- The overlay is rendered regardless of the `modal` prop value
- Vaul's CSS rule: `[data-vaul-overlay][data-vaul-snap-points=true]:not([data-vaul-snap-points-overlay=true]):not([data-state=closed]){opacity:0}` hides it visually but not interactively
- For the showcase page this is acceptable; for production use it would be a bug

## Proposed Solutions

### Option A: Conditionally skip overlay for non-modal drawers

Pass the `modal` prop through context and conditionally render `<DrawerOverlay />` only when `modal !== false`.

- **Pros:** Clean fix, no overlay in DOM at all for non-modal
- **Cons:** Requires context plumbing or a prop on `DrawerContent`
- **Effort:** Medium
- **Risk:** Low

### Option B: Add pointer-events-none when overlay is invisible

Apply `pointer-events: none` to the overlay when at a snap point below `fadeFromIndex`.

- **Pros:** Overlay stays in DOM for transitions, simpler change
- **Cons:** More fragile, depends on snap point state
- **Effort:** Small
- **Risk:** Low

## Technical Details

- **Affected file:** `packages/ui/src/primitives/drawer.tsx` (line 55)
- **DrawerOverlay component:** lines 32-46

## Acceptance Criteria

- [ ] Page content behind a non-modal peeking drawer is clickable at the peek snap point
- [ ] Overlay still functions correctly when drawer is dragged to higher snap points
- [ ] Modal drawers are unaffected

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-09 | Created from code review of peeking drawer | Vaul hides overlay visually but not interactively for snap-point drawers |
| 2026-02-09 | Investigated — false positive. Vaul's `DrawerPrimitive.Overlay` returns null for `modal={false}` drawers. No overlay enters the DOM, so no pointer-event interception occurs. No code change needed. | Vaul handles non-modal overlay suppression internally |

## Resources

- Branch: `ui-factory/020926-drawer`
- Primitive: `packages/ui/src/primitives/drawer.tsx`
