---
status: completed
priority: p2
issue_id: "117"
tags: [code-review, performance, race-condition, mirror, profile]
dependencies: []
---

# willChange Cleared Immediately Instead of After Snap Animation

## Problem Statement

`snapTo` in `use-bottom-sheet.ts` clears `willChange` immediately after starting the 300ms snap animation. This tells the browser to de-promote the composited layer mid-animation, potentially causing a repaint storm and visible jank as the compositor hands the element back to the main thread.

## Findings

- **Source:** julik-frontend-races-reviewer agent
- **Location:** `apps/mirror/features/profile/hooks/use-bottom-sheet.ts` `snapTo` function (lines 108-121)

## Proposed Solutions

### Option A: Use transitionend listener with timeout fallback (Recommended)
```typescript
const cleanup = () => {
  if (sheet) { sheet.style.willChange = ""; sheet.removeEventListener("transitionend", cleanup); }
  if (bg) bg.style.willChange = "";
};
if (sheet) sheet.addEventListener("transitionend", cleanup, { once: true });
setTimeout(cleanup, 350); // safety net
```
- **Effort:** Low
- **Risk:** Low — `once: true` prevents listener leak

## Acceptance Criteria

- [x] `willChange` cleared after snap animation completes, not before
- [x] No mid-animation layer de-promotion jank

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-09 | Created from PR #106 review | Clear willChange after transitionend, not during animation |
| 2026-02-09 | Implemented Option A | Used `transitionend` listener with `{ once: true }` + 350ms setTimeout safety net. Build passes. |

## Resources

- PR: https://github.com/hpark0011/feel-good/pull/106
