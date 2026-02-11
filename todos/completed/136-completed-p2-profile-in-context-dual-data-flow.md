---
status: completed
priority: p2
issue_id: "136"
tags: [code-review, architecture, react-context, mirror]
dependencies: []
---

# profile in ProfileContext Creates Dual Data Flow Path

## Problem Statement

`ProfileContextValue` bundles `{ profile, isOwner }`, but `profile` is already prop-drilled directly to `ProfileInfoView` in both mobile and desktop branches of `ProfileShell`. This creates two competing delivery mechanisms for the same `Profile` object. A developer modifying a descendant could read `profile` from context while a sibling reads it from props, and the two paths could diverge during refactoring.

The context was motivated by `isOwner` — the value that actually needs to skip component tree levels. `profile` does not need context delivery since it is already available at the points where it is consumed.

## Findings

- **Source:** architecture-strategist, kieran-typescript-reviewer, code-simplicity-reviewer, performance-oracle (4/6 agents)
- **Location:** `apps/mirror/features/profile/context/profile-context.tsx` lines 6-9
- **Evidence:** `ProfileInfoView` receives `profile` as a direct prop on lines 50 and 75 of `profile-shell.tsx`

## Proposed Solutions

### Option A: Narrow context to isOwner only (Recommended) ✅ IMPLEMENTED
- Change `ProfileContextValue` to `{ isOwner: boolean }`
- Remove `profile` from `useMemo` deps and context value
- Keep `useIsProfileOwner()` as the public hook
- Removed `useProfileContext` since it no longer returns anything beyond `isOwner`
- **Effort:** Small
- **Risk:** None

## Acceptance Criteria

- [x] Only one delivery mechanism for `profile` data (props)
- [x] `isOwner` is available via context for deeply nested components
- [x] No dual-source confusion for consumers

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-11 | Created from PR #115 review | Context should hold only values that need to skip tree levels; avoid duplicating prop-drilled data |
| 2026-02-11 | Implemented Option A | Removed `profile` from context, inlined `useProfileContext` into `useIsProfileOwner`, removed `Profile` type import |

## Resources

- PR: https://github.com/hpark0011/feel-good/pull/115
