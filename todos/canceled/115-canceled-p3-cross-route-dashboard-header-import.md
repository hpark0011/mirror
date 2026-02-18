---
status: canceled
priority: p3
issue_id: "115"
tags: [code-review, architecture, mirror]
dependencies: []
---

# Cross-Route DashboardHeader Import From _components

## Problem Statement

`DashboardHeader` lives in `app/(protected)/_components/` but is imported by `app/(protected)/dashboard/_components/dashboard-view.tsx`. This creates a cross-route dependency on a private directory. If the header is shared across routes under `(protected)`, it should be promoted to `features/` or `components/`.

## Findings

- **Source:** architecture-strategist agent
- **Location:** `apps/mirror/app/(protected)/dashboard/_components/dashboard-view.tsx`
- **Note:** This was already tracked in todo #106 (completed) but re-surfaced in this review

## Proposed Solutions

### Option A: Promote to app-level components/ or features/ (Recommended)
Move `DashboardHeader` to `features/dashboard/components/` or `components/` if used by multiple route groups.
- **Effort:** Low
- **Risk:** Low

### Option B: Accept current structure
If `_components/` under `(protected)` is considered shared within that route group, the current location is acceptable by convention.
- **Effort:** None
- **Risk:** Convention confusion

## Acceptance Criteria

- [ ] Clear convention for cross-route shared components documented or enforced

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-09 | Created from PR #106 review | Previously tracked in #106, re-surfaced |

## Resources

- PR: https://github.com/hpark0011/feel-good/pull/106
