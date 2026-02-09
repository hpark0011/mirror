---
status: completed
priority: p3
issue_id: "104"
tags: [code-review, cleanup, mirror]
dependencies: []
---

# willChange Not Cleaned Up on Unmount During Active Drag

## Problem Statement

If `MobileProfileLayout` unmounts while a drag is active (e.g., Turbo navigation, React re-render), the `useEffect` cleanup removes event listeners but does not reset `willChange` or `stateRef`. Under React strict mode double-mount, state machine starts in a dirty position.

## Findings

- **Source:** julik-frontend-races-reviewer agent
- **Location:** `apps/mirror/app/(protected)/dashboard/_hooks/use-bottom-sheet.ts` lines 194-199, 216-221 (cleanup)
- **Evidence:** Cleanup only calls `removeEventListener`, not `style.willChange = ""` or `stateRef.current = "IDLE"`.

## Proposed Solutions

### Option A: Add cleanup to useEffect (Recommended)
- Reset `stateRef.current = "IDLE"` and clear `willChange` on all managed elements in cleanup
- **Effort:** Small
- **Risk:** Low

## Acceptance Criteria

- [ ] `willChange` cleared on unmount
- [ ] `stateRef` reset on unmount
- [ ] Works correctly under React strict mode

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-09 | Created from PR #105 round 2 review | Always reset imperative state in effect cleanup |

## Resources

- PR: https://github.com/hpark0011/feel-good/pull/105
