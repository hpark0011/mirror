---
status: completed
priority: p2
issue_id: "097"
tags: [code-review, race-condition, mirror]
dependencies: []
---

# Scroll-to-Drag Timer Fires Without Checking Current State

## Problem Statement

The scroll handler in `useBottomSheet` sets a 100ms timeout that calls `snapTo(PEEK)`. If the user starts a new drag gesture within that 100ms window, the timer fires and snaps the sheet down mid-gesture, teleporting it out from under the user's finger. The timer callback checks `scrollContainer.scrollTop <= 0` but does not check `stateRef.current`.

## Findings

- **Source:** julik-frontend-races-reviewer agent
- **Location:** `apps/mirror/app/(protected)/dashboard/_hooks/use-bottom-sheet.ts` lines 231-253 (scroll handler)
- **Evidence:** Timer callback at ~line 247 lacks `stateRef.current !== "SCROLLING"` guard. `handlePointerDown` does not clear the timer.

## Proposed Solutions

### Option A: Add state guard + clear timer on drag start (Recommended)
```typescript
// In timer callback:
if (stateRef.current !== "SCROLLING") return;

// In handlePointerDown, before setting DRAGGING:
if (scrollToleranceTimerRef.current) {
  clearTimeout(scrollToleranceTimerRef.current);
  scrollToleranceTimerRef.current = null;
}
```
- **Effort:** Small
- **Risk:** Low

## Acceptance Criteria

- [ ] Timer callback checks `stateRef.current`
- [ ] `handlePointerDown` clears pending timer
- [ ] No snap-during-drag possible

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-09 | Created from PR #105 round 2 review | Always guard delayed callbacks with current state check |

## Resources

- PR: https://github.com/hpark0011/feel-good/pull/105
