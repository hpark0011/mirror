---
status: completed
priority: p3
issue_id: "138"
tags: [code-review, simplification, react, mirror]
dependencies: []
---

# Duplicate ProfileProvider Wrapping in Mobile and Desktop Branches

## Problem Statement

`ProfileShell` wraps with `<ProfileProvider>` in both the mobile return (line 42) and desktop return (line 70). The provider could be lifted above the `if (isMobile)` branch to eliminate the duplication.

## Findings

- **Source:** kieran-typescript-reviewer, code-simplicity-reviewer (2/6 agents)
- **Location:** `apps/mirror/app/[username]/_components/profile-shell.tsx` lines 42 and 70
- **Evidence:** Both branches wrap with identical `<ProfileProvider value={contextValue}>`

## Proposed Solutions

### Option A: Lift provider above conditional (Recommended)
- Wrap once above the `if (isMobile)` branch
- Requires extracting mobile/desktop into sub-expressions or using ternary
- **Effort:** Small
- **Risk:** None

## Acceptance Criteria

- [ ] `<ProfileProvider>` appears once in the component
- [ ] Context is available in both mobile and desktop subtrees

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-11 | Created from PR #115 review | Lift shared wrappers above conditionals to avoid duplication |

## Resources

- PR: https://github.com/hpark0011/feel-good/pull/115
