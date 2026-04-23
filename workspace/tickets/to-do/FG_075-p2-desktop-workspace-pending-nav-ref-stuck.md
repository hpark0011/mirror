---
id: FG_075
title: "Desktop content toggle recovers when default-content navigation does not commit"
date: 2026-04-23
type: fix
status: to-do
priority: p2
description: "isPendingNavigationRef in DesktopWorkspace is set when opening the default content route but is only cleared when hasContentRoute flips false→true in the layout effect. If the user navigates elsewhere before the route commits, if the push is aborted, or if hasContentRoute never transitions as expected, the ref stays true and every subsequent content-toggle silently no-ops. Same failure family as FG_060 (ref set on action, cleared only by an observed effect that may never arrive)."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "grep -cE 'isPendingNavigationRef\\.current\\s*=\\s*false|setIsPendingNavigation\\(\\s*false\\s*\\)' apps/mirror/app/[username]/_components/desktop-workspace.tsx returns 2 or more (cleared on both the happy transition AND at least one recovery path)"
  - "A unit or Playwright test under apps/mirror/app/[username]/_components/__tests__/ or apps/mirror/e2e/ exercises the stuck-toggle path: collapsed panel + pending navigation that never commits + subsequent toggle click still opens the panel"
  - "The content toggle remains operable after onOpenDefaultContent is invoked but hasContentRoute never transitions to true (verified by the test above)"
  - "The resize-handle pointer-down interceptor in apps/mirror/app/[username]/_components/desktop-workspace.tsx does not allow a second concurrent openDefaultContentRoute() call while one is pending (existing guard preserved)"
  - "pnpm --filter=@feel-good/mirror build exits 0"
  - "pnpm --filter=@feel-good/mirror lint produces 0 errors"
owner_agent: "React state synchronization fixer"
---

# Desktop content toggle recovers when default-content navigation does not commit

## Context

Discovered during code review of `apps/mirror/app/[username]/_components/desktop-workspace.tsx`. The component guards `openDefaultContentRoute()` against double-invocation with a ref:

```ts
// desktop-workspace.tsx:47
const isPendingNavigationRef = useRef(false);

// desktop-workspace.tsx:71-77
const openDefaultContentRoute = useCallback(() => {
  if (!onOpenDefaultContent) return;
  markContentPanelOpenStart();
  isPendingNavigationRef.current = true;
  onOpenDefaultContent();
}, [onOpenDefaultContent]);
```

The ref is cleared in exactly one place — the `useLayoutEffect` at line 134-150, and only when `previousHasContentRoute === false && hasContentRoute === true`:

```ts
if (hasContentRoute) {
  markContentPanelRouteReady();
  isPendingNavigationRef.current = false;
  ...
}
```

`onOpenDefaultContent` calls `router.push(defaultContentHref)` in `workspace-shell.tsx:60-63`. `router.push` is fire-and-forget — no awaitable result and no guarantee the navigation commits. If the user hits the toggle while collapsed, then hits back/forward or navigates away before the route transitions, `hasContentRoute` never flips `false → true` and the ref stays `true` forever. Both subsequent toggle paths then short-circuit:

- `toggleContentPanel` — line 80: `if (isPendingNavigationRef.current) return;`
- `handleResizePointerDownCapture` — line 119: `if (isPendingNavigationRef.current) return;`

The content panel becomes permanently un-openable via toggle or resize-handle drag until the page is reloaded. This is the same failure shape as FG_060 (completed): a ref latched by an action and only cleared by an observed downstream effect that may never arrive.

## Goal

The content toggle and the resize-handle interceptor remain operable regardless of whether a default-content navigation commits. The pending-navigation guard still prevents double-invocation during the in-flight window, but it does not permanently latch when the route transition never arrives.

## Scope

- Add at least one recovery path that clears the pending-navigation signal when the route transition does not arrive (e.g., cleared on any `hasContentRoute` change, cleared after a timeout, or cleared when the component unmounts/route changes).
- Preserve the existing double-invocation guard during the legitimate in-flight window.
- Add a regression test (unit test with a mocked `onOpenDefaultContent` that never causes `hasContentRoute` to flip, or a Playwright test that navigates back mid-flight) that fails against the current code and passes after the fix.

## Out of Scope

- Refactoring `DesktopWorkspace` into smaller hooks (tracked separately — FG_076).
- Changing the public `onOpenDefaultContent` prop contract or the `workspace-shell` caller.
- Changing the perf-mark calls in `lib/perf/content-panel-open.ts`.
- Auditing other refs in the file for similar patterns (handled by FG_076's extraction).

## Approach

Replace the single-clear-site model with a bounded-lifetime model. The simplest option that preserves intent:

1. Keep the ref (or convert to state), but also clear it in the existing `useLayoutEffect` whenever `hasContentRoute` changes at all, not only on `false → true`. Any observed route transition — including away from a content route, or a no-op re-render after remount — resets the guard.
2. Add a timeout fallback in `openDefaultContentRoute` (e.g., 1500ms) that clears the ref if `hasContentRoute` has not transitioned by then. Clear the timeout when the effect observes the successful transition.

Either alone fixes the stuck-state; combining both is belt-and-suspenders. Pick one and justify briefly in the PR.

If the implementer prefers moving the signal to state instead of a ref, that is acceptable as long as it does not cause extra renders during the normal happy-path toggle.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Read `apps/mirror/app/[username]/_components/desktop-workspace.tsx` end-to-end; confirm `isPendingNavigationRef` is referenced at lines 47, 75, 80, 119, 144 and nowhere else.
2. Choose one of the two approaches in the Approach section (or both). If adding a timeout, use `setTimeout`/`clearTimeout` pair with cleanup on unmount; do NOT use `setTimeout` for rendering timing (that would violate `.claude/rules/react-components.md`).
3. Update `openDefaultContentRoute` and/or the existing `useLayoutEffect` so the pending-navigation signal clears on any observed `hasContentRoute` change OR after the chosen timeout.
4. Add a regression test under `apps/mirror/app/[username]/_components/__tests__/` (unit) or `apps/mirror/e2e/` (Playwright) that: renders with `hasContentRoute=false`, clicks the toggle, asserts `onOpenDefaultContent` was called once, then without flipping `hasContentRoute`, clicks the toggle again and asserts the component attempts to open again (or the layout becomes 50/50 if `hasContentRoute` has since become true). The test should fail against `HEAD` and pass after the fix.
5. Run `pnpm --filter=@feel-good/mirror build && pnpm --filter=@feel-good/mirror lint`.
6. Run the new test (`pnpm --filter=@feel-good/mirror test:unit` or `test:e2e`) and confirm it passes.

## Constraints

- The existing double-invocation guard must still hold during the legitimate in-flight window — do not simply remove `if (isPendingNavigationRef.current) return`.
- Do not change the `DesktopWorkspaceProps` shape or the `WorkspaceChromeContextValue` shape (`apps/mirror/app/[username]/_providers/workspace-chrome-context.tsx`).
- Do not change perf-mark ordering in `lib/perf/content-panel-open.ts`; `markContentPanelOpenStart` must still fire exactly once per legitimate open attempt.
- If using `setTimeout`, it must have a cleanup path on unmount.

## Resources

- File: `apps/mirror/app/[username]/_components/desktop-workspace.tsx:47,71-77,80,104-132,134-150`
- Caller: `apps/mirror/app/[username]/_components/workspace-shell.tsx:60-63,86-93`
- Context shape: `apps/mirror/app/[username]/_providers/workspace-chrome-context.tsx`
- Related: `workspace/tickets/completed/FG_060-p1-animation-ref-stuck-on-failure.md` (sister bug, same failure family)
- Convention: `.claude/rules/react-components.md` (no setTimeout for rendering timing), `.claude/rules/verification.md` Tier 4
