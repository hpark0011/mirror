---
status: completed
priority: p2
issue_id: "099"
tags: [code-review, performance, mirror]
dependencies: []
---

# Redundant useSession() Loading Guard in DashboardContent

## Problem Statement

`DashboardContent` calls `useSession()` and shows a loading spinner while the session hydrates. However, the server-side `(protected)/layout.tsx` already validates authentication via `isAuthenticated()` + `redirect()`. By the time `DashboardContent` renders, the user is authenticated. The client-side loading state creates an unnecessary flash and redundant HTTP request.

## Findings

- **Source:** architecture-strategist, kieran-typescript-reviewer, code-simplicity-reviewer agents
- **Location:** `apps/mirror/app/(protected)/dashboard/_components/dashboard-content.tsx` lines 19, 23-28
- **Evidence:** `(protected)/layout.tsx` lines 10-12 calls `isAuthenticated()` and redirects if false. Middleware also checks cookie. Triple-layer auth check.

## Proposed Solutions

### Option A: Remove useSession loading guard (Recommended)
- Remove `useSession()` import and `isLoading` check
- If session data is needed later, pass from server component as prop
- **Effort:** Small
- **Risk:** Low

## Acceptance Criteria

- [ ] No client-side session loading spinner
- [ ] Server layout auth guard still protects route
- [ ] No redundant HTTP request to session endpoint

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-09 | Created from PR #105 round 2 review | Don't re-check auth client-side when server layout already validates |

## Resources

- PR: https://github.com/hpark0011/feel-good/pull/105
