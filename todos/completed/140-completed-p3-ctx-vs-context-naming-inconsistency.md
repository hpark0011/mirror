---
status: completed
priority: p3
issue_id: "140"
tags: [code-review, naming, consistency, mirror]
dependencies: []
---

# ctx vs context Variable Naming Inconsistency

## Problem Statement

`useProfileContext` uses `const ctx = useContext(ProfileContext)` while all other context hooks in the codebase use the full word `context`:
- `LayoutModeContext`: `const context = useContext(LayoutModeContext)`
- `DockProvider`: `const context = useContext(DockContext)`

Minor inconsistency but worth aligning for codebase uniformity.

## Findings

- **Source:** pattern-recognition-specialist (1/6 agents)
- **Location:** `apps/mirror/features/profile/context/profile-context.tsx` line 16
- **Evidence:** Grep across all context files shows `context` is the convention

## Proposed Solutions

### Option A: Rename ctx to context (Recommended)
- Change `const ctx` to `const context` in `useProfileContext`
- **Effort:** Small
- **Risk:** None

## Acceptance Criteria

- [ ] Variable name matches codebase convention (`context` not `ctx`)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-11 | Created from PR #115 review | Follow existing naming conventions for local variables in pattern-heavy code |

## Resources

- PR: https://github.com/hpark0011/feel-good/pull/115
