---
status: completed
priority: p2
issue_id: "110"
tags: [code-review, dead-code, mirror, profile]
dependencies: []
---

# Dead Code: scrollTopAtStartRef Written But Never Read

## Problem Statement

`scrollTopAtStartRef` in `use-bottom-sheet.ts:46` is assigned a value on pointer-down but is never read anywhere in the hook. This is leftover dead code from a previous iteration.

## Findings

- **Source:** kieran-typescript-reviewer, code-simplicity-reviewer agents
- **Location:** `apps/mirror/features/profile/hooks/use-bottom-sheet.ts` line 46

## Proposed Solutions

### Option A: Remove the ref (Recommended)
Delete `scrollTopAtStartRef` declaration and its assignment.
- **Effort:** Trivial
- **Risk:** None — value is never consumed

## Acceptance Criteria

- [ ] `scrollTopAtStartRef` removed from hook
- [ ] No references to it remain
- [ ] Gesture behavior unchanged

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-09 | Created from PR #106 review | Remove dead refs during cleanup passes |

## Resources

- PR: https://github.com/hpark0011/feel-good/pull/106
