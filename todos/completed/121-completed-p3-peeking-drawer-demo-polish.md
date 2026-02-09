---
status: completed
priority: p3
issue_id: "121"
tags: [code-review, quality, ui-factory]
dependencies: []
---

# Polish peeking drawer demo: comment, onOpenChange, bottom padding

## Problem Statement

Three minor polish items identified across the peeking drawer demo code:

1. The `!important` overrides lack an explanatory comment
2. Missing `onOpenChange` handler causes a confusing visual snap-back on drag-to-dismiss
3. The always-visible 80px peek may occlude the bottom of the last demo section

## Findings

- **Comment:** 3 out of 5 review agents flagged the `!important` overrides as needing a brief comment explaining the specificity conflict with vaul's snap-point height calculation
- **onOpenChange:** Without a handler, dragging below the "80px" snap triggers vaul's dismiss animation, but the drawer snaps back since `open` is always `true`. A no-op or comment makes the intent explicit.
- **Padding:** The peeking drawer overlays the bottom 80px of the viewport, potentially occluding the "Direction: Left" section's content

## Proposed Solutions

### All three in one pass

In `peeking-drawer-demo.tsx`:
- Add a comment above `DrawerContent` explaining the overrides
- Add a comment or no-op `onOpenChange` on the `Drawer`

In `drawer-variants.tsx`:
- Add `pb-24` to the root `<div>` to provide clearance for the peek

- **Effort:** Small (5 minutes)
- **Risk:** None

## Technical Details

- **Affected files:**
  - `apps/ui-factory/app/components/drawer/_components/peeking-drawer-demo.tsx`
  - `apps/ui-factory/app/components/drawer/_components/drawer-variants.tsx`

## Acceptance Criteria

- [ ] Comment explains why `!important` overrides are needed
- [ ] Drag-to-dismiss behavior is either handled or documented
- [ ] All demo sections are fully visible above the 80px peek

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-09 | Created from code review synthesis | Three independent minor items grouped for efficiency |

## Resources

- Branch: `ui-factory/020926-drawer`
