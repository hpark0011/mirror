---
status: canceled
priority: p3
issue_id: "114"
tags: [code-review, performance, mirror, profile]
dependencies: []
---

# Render Prop in DashboardView Creates Unstable Reference

## Problem Statement

The `articles` prop on `DashboardView` accepts a render function `(scrollRoot) => ReactNode`. When called from `DashboardPage` (server component), this is fine since server components don't re-render. However, if the pattern is reused in a client component context, the inline function would create a new reference on every render.

## Findings

- **Source:** performance-oracle agent
- **Location:** `apps/mirror/app/(protected)/dashboard/page.tsx` line 9

## Proposed Solutions

### Option A: Accept as-is with documentation (Recommended)
Since the current caller is a server component, this is safe today. Add a comment noting the pattern assumes a stable caller.
- **Effort:** Trivial
- **Risk:** None currently

### Option B: Memoize if moved to client component
If this page ever becomes a client component, wrap the render function in `useCallback`.
- **Effort:** Low
- **Risk:** Premature optimization if done now

## Acceptance Criteria

- [ ] Pattern documented or noted as server-component-only safe

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-09 | Created from PR #106 review | Render props are safe in server components, need memoization in client |

## Resources

- PR: https://github.com/hpark0011/feel-good/pull/106
