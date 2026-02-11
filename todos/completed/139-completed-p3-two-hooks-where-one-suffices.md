---
status: completed
priority: p3
issue_id: "139"
tags: [code-review, simplification, react, mirror]
dependencies: ["136"]
---

# Two Context Hooks Where One Would Suffice

## Problem Statement

`useProfileContext()` returns the full context value and `useIsProfileOwner()` is a one-liner wrapper that returns `.isOwner`. With zero consumers of either hook, exporting both is speculative API surface. A single hook is sufficient until a second distinct access pattern emerges.

Note: If #136 narrows the context to `{ isOwner: boolean }` only, then `useProfileContext` and `useIsProfileOwner` become equivalent, making this moot.

## Findings

- **Source:** kieran-typescript-reviewer, code-simplicity-reviewer (2/6 agents)
- **Location:** `apps/mirror/features/profile/context/profile-context.tsx` lines 15-24
- **Evidence:** Zero consumers outside definition and barrel export

## Proposed Solutions

### Option A: Export only useIsProfileOwner (Recommended)
- Keep `useProfileContext` internal (unexported) or remove it
- Export only the narrow `useIsProfileOwner` hook
- **Effort:** Small
- **Risk:** None

## Acceptance Criteria

- [x] Only the hooks that are consumed are exported from the barrel
- [x] Public API surface is minimal

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-11 | Created from PR #115 review | Don't export speculative API — export when consumed |
| 2026-02-11 | Completed: removed `useProfileContext` export | Made hook module-private, removed from barrel |

## Resources

- PR: https://github.com/hpark0011/feel-good/pull/115
