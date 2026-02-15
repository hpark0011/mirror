---
status: completed
priority: p1
issue_id: "186"
tags: [code-review, pr-124, scroll, hydration, mobile]
dependencies: []
---

# Scroll container null during mobile hydration race

## Problem Statement

`useScrollMemory` receives its scroll container from `isMobile ? mobileScrollRoot : desktopScrollRoot` in `profile-shell.tsx`. The `useIsMobile()` hook initializes as `false` (SSR default), flips to `true` after hydration on mobile. During this transition, `mobileScrollRoot` is null (not yet ref'd), so the first navigation on mobile misses scroll save/restore entirely.

## Findings

- `apps/mirror/app/[username]/_components/profile-shell.tsx` — `useScrollMemory(isMobile ? mobileScrollRoot : desktopScrollRoot)`
- `apps/mirror/hooks/use-scroll-memory.ts:12` — early return when `scrollContainer` is null
- `useIsMobile()` initializes `false`, flips after first effect on mobile devices
- First article navigation on mobile will not save scroll position

## Proposed Solutions

### Option A: Stabilize container selection (Recommended)

Use a ref callback that captures the correct container regardless of hydration state. Or track both containers and pick the one that's actually in the viewport.

- Effort: Medium
- Risk: Low

### Option B: Add both containers to useScrollMemory

Pass both refs and let the hook determine which is active based on visibility/dimensions.

- Effort: Medium
- Risk: Low

### Option C: Delay scroll memory until hydration settles

Skip scroll operations on the very first render. Use a `hasMounted` ref.

- Effort: Small
- Risk: Medium (first navigation still has no scroll memory)

## Acceptance Criteria

- [ ] Scroll position saves/restores correctly on mobile on first navigation
- [ ] No errors when container is null during hydration
- [ ] Desktop scroll memory unaffected

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-13 | Created from PR #124 code review | useIsMobile hydration race affects container ref selection |
