---
id: FG_051
title: "Panel toggle guards against double-navigation race"
date: 2026-03-09
type: fix
status: completed
priority: p1
description: "toggleContentPanel and handleResizePointerDownCapture call router.push() when collapsed with no content route, but the panel stays collapsed until the async route change triggers useLayoutEffect. Users can double-click during this window causing duplicate navigation. The resize handler also fails to stop event propagation, letting the resize library start a drag while navigation is in-flight."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "Clicking the vinyl toggle twice rapidly when collapsed produces only one router.push call (verify via e2e test with double-click)"
  - "handleResizePointerDownCapture calls event.preventDefault() and event.stopPropagation() when navigating — grep confirms the calls exist"
  - "A pending guard (state or ref) is set before router.push and cleared when hasContentRoute flips to true"
  - "Existing e2e tests in profile-content-panel-toggle.spec.ts still pass"
owner_agent: "Frontend state management specialist"
---

# Panel toggle guards against double-navigation race

## Context

Discovered during code review of PR #193 (`feat-hide-content-panel`). In `apps/mirror/app/[username]/_components/desktop-workspace.tsx:75-87`, `toggleContentPanel` calls `openDefaultContentRoute()` (which is `router.push()`) when the panel is collapsed and there is no content route. The panel expansion then relies on the `useLayoutEffect` at line 104 to detect the route change and call `setLayout([50, 50])`. Between the click and the async re-render, `isContentPanelCollapsed` is still `true` and `hasContentRoute` is still `false`, so a second click triggers a duplicate `router.push()`.

The same race exists in `handleResizePointerDownCapture` (line 89-102), which additionally fails to call `event.preventDefault()` / `event.stopPropagation()`, allowing the resize library to start a drag concurrently with navigation.

## Goal

Rapid clicks on the toggle button or resize handle produce exactly one navigation, and the resize library does not start a drag when navigation is triggered.

## Scope

- Add a navigation pending guard to `desktop-workspace.tsx`
- Apply guard to both `toggleContentPanel` and `handleResizePointerDownCapture`
- Add `event.preventDefault()` + `event.stopPropagation()` to `handleResizePointerDownCapture` when it decides to navigate or expand
- Accept the event parameter in `handleResizePointerDownCapture`

## Out of Scope

- Extracting shared logic between toggle and resize handler (see FG_053)
- Adding visual loading feedback during navigation pending state
- Mobile redirect behavior

## Approach

Add an `isPendingNavigationRef` (useRef<boolean>) that gets set to `true` before `router.push` and cleared to `false` in the `useLayoutEffect` when `hasContentRoute` becomes `true`. Both `toggleContentPanel` and `handleResizePointerDownCapture` check this ref before acting. The resize handler's callback signature changes to accept `React.PointerEvent` and calls `preventDefault`/`stopPropagation` when navigating.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Add `const isPendingNavigationRef = useRef(false)` to `desktop-workspace.tsx`
2. Set `isPendingNavigationRef.current = true` before `openDefaultContentRoute()` in `toggleContentPanel`
3. Add early return `if (isPendingNavigationRef.current) return` at the top of `toggleContentPanel`
4. Clear `isPendingNavigationRef.current = false` in the `useLayoutEffect` when `hasContentRoute` flips to `true`
5. Apply the same guard to `handleResizePointerDownCapture` and change its signature to accept `(event: React.PointerEvent)`
6. Call `event.preventDefault()` and `event.stopPropagation()` in `handleResizePointerDownCapture` when navigating or expanding
7. Run existing e2e tests: `pnpm --filter=@feel-good/mirror test:e2e`

## Constraints

- Must not change the public API of `DesktopWorkspace` props
- Use a ref (not state) for the guard to avoid unnecessary re-renders

## Resources

- PR #193: https://github.com/anthropics/feel-good/pull/193
- `apps/mirror/app/[username]/_components/desktop-workspace.tsx:75-102`
