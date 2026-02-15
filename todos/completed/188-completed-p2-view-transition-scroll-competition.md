---
status: completed
priority: p2
issue_id: "188"
tags: [code-review, pr-124, scroll, view-transition, animation]
dependencies: ["186"]
---

# ViewTransition and scroll restoration competing

## Problem Statement

The scroll container for `useScrollMemory` is wrapped inside a `<ViewTransition name="profile-content">`. The view transition API captures element snapshots before/after navigation. If scroll restoration fires during the transition, the snapshot may capture wrong scroll positions, or the transition animation may reset the restored position.

## Findings

- `apps/mirror/app/[username]/_components/profile-shell.tsx` — scroll container is child of `<ViewTransition>`
- `apps/mirror/styles/globals.css` — slide-from-right / slide-to-right animations on profile-content
- `useScrollMemory` uses `useLayoutEffect` which fires synchronously but before paint — may conflict with transition timing

## Proposed Solutions

### Option A: Coordinate with transition callbacks

Use `document.startViewTransition` callbacks to time scroll restoration after the transition completes.

- Effort: Medium
- Risk: Medium (API still experimental)

### Option B: Move scroll container outside ViewTransition

Restructure so the scrolling container wraps the ViewTransition rather than being inside it.

- Effort: Medium
- Risk: Low

## Acceptance Criteria

- [ ] Scroll restoration works reliably with view transitions
- [ ] No visible scroll jumps during transition animations
- [ ] Back navigation restores correct scroll position

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-13 | Created from PR #124 code review | ViewTransition snapshots and scroll restoration can conflict |
