---
status: completed
priority: p2
issue_id: "125"
tags: [code-review, view-transitions, react-hooks, mirror]
dependencies: []
---

# Add cleanup for data-nav-direction attribute on unmount

## Problem Statement

The `useNavDirection` hook sets `data-nav-direction` on `document.documentElement` but never removes it. If `DashboardShell` unmounts (e.g., navigating away from dashboard), the stale attribute persists on `<html>` forever. This is a React hook hygiene issue for DOM mutations.

## Findings

- **TypeScript Reviewer (P2):** Standard React hook hygiene — `useLayoutEffect` should return cleanup
- **Frontend Races Reviewer (P2):** Stale attribute could cause wrong animations on non-navigation re-renders
- **Pattern Recognition (P3):** No functional impact currently but could confuse future development
- **Architecture (P3):** Benign now since CSS selectors only match during active transitions

## Proposed Solutions

### Add cleanup function to useLayoutEffect

```ts
useLayoutEffect(() => {
  if (pathname === prevPathname.current) return;
  const isForward = pathname.startsWith("/dashboard/articles/");
  document.documentElement.dataset.navDirection = isForward ? "forward" : "back";
  prevPathname.current = pathname;

  return () => {
    delete document.documentElement.dataset.navDirection;
  };
}, [pathname]);
```

- **Effort:** Small (2 lines)
- **Risk:** None

## Technical Details

- **Affected files:** `apps/mirror/app/(protected)/dashboard/_components/use-nav-direction.ts`

## Acceptance Criteria

- [ ] `data-nav-direction` is removed from `<html>` when `DashboardShell` unmounts
- [ ] Transitions still work correctly within the dashboard

## Work Log

- 2026-02-11: Created from PR #113 code review.

## Resources

- PR #113: https://github.com/hpark0011/feel-good/pull/113
