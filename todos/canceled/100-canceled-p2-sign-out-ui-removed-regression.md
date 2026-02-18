---
status: canceled
priority: p2
issue_id: "100"
tags: [code-review, regression, mirror]
dependencies: []
---

# Sign-Out UI Removed With No Replacement

## Problem Statement

The old dashboard page had a sign-out button. The new dashboard has no sign-out mechanism anywhere in the protected area. `DashboardHeader` only contains `ThemeToggleButton`. The `signOut` function is still exported from `auth-client.ts` but is not wired to any UI element. Users can sign in but cannot sign out.

## Findings

- **Source:** kieran-typescript-reviewer agent
- **Location:** `apps/mirror/app/(protected)/_components/dashboard-header.tsx` (only 9 lines, only ThemeToggleButton)
- **Evidence:** `grep signOut` in mirror app returns only `lib/auth-client.ts:14` (export), no UI usage.

## Proposed Solutions

### Option A: Add sign-out button to DashboardHeader (Recommended)
- **Effort:** Small
- **Risk:** Low

## Acceptance Criteria

- [ ] Sign-out button present in protected area
- [ ] Clicking sign-out calls `signOut()` and redirects to sign-in
- [ ] Sign-out works on both mobile and desktop layouts

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-09 | Created from PR #105 round 2 review | Check for removed UI functionality when refactoring layouts |

## Resources

- PR: https://github.com/hpark0011/feel-good/pull/105
