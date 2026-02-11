---
status: pending
priority: p2
issue_id: "137"
tags: [code-review, git-hygiene, mirror]
dependencies: []
---

# Unrelated Gradient Removal Bundled in ProfileContext PR

## Problem Statement

`profile-header.tsx` line 22 removes `bg-linear-to-b from-background via-background/70 to-transparent` — a visual change completely unrelated to the ProfileContext feature. Mixing unrelated styling changes with functional infrastructure makes git blame less useful and complicates bisection if the gradient removal causes visual regressions.

## Findings

- **Source:** architecture-strategist, pattern-recognition-specialist, code-simplicity-reviewer (3/6 agents)
- **Location:** `apps/mirror/app/[username]/_components/profile-header.tsx` line 22
- **Evidence:** Diff shows gradient removal alongside context additions; PR title and description do not mention this change

## Proposed Solutions

### Option A: Split into separate commit (Recommended)
- Move the gradient removal to its own commit with a descriptive message like `style(mirror): remove profile header gradient`
- Keep the ProfileContext commit focused
- **Effort:** Small
- **Risk:** None

### Option B: Mention in PR description
- Add a note to the PR body explaining the gradient removal
- Less ideal but acceptable for a one-line change
- **Effort:** Small
- **Risk:** None

## Acceptance Criteria

- [ ] Gradient removal is in a separate commit or documented in PR description
- [ ] ProfileContext commit only contains context-related changes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-11 | Created from PR #115 review | Keep PRs atomic — one concern per commit |

## Resources

- PR: https://github.com/hpark0011/feel-good/pull/115
