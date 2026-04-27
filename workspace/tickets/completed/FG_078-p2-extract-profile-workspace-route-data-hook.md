---
id: FG_078
title: "WorkspaceShell delegates route-derivation to a single hook"
date: 2026-04-27
type: refactor
status: completed
priority: p2
description: "workspace-shell.tsx is a junction box: it derives isChatOpen, hasContentRoute, routeState, defaultContentHref, profileBackHref, and openDefaultContent just to thread each value into one of two child trees. Extract the route-derivation into a useProfileWorkspaceRouteData hook so the shell shrinks to picking the mobile vs desktop variant. MobileWorkspace can call useChatSearchParams and useParams directly to drop isChatOpen and profileBackHref from its prop surface."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "A hook (e.g. useProfileWorkspaceRouteData) exists and is the only call site of getContentRouteState, isProfileTabKind for hasContentRoute, getContentHref for defaultContentHref, and buildChatAwareHref for profileBackHref outside its own implementation"
  - "apps/mirror/app/\\[username\\]/_components/workspace-shell.tsx has at most ~30 lines of body excluding imports/exports (currently ~60)"
  - "MobileWorkspace component does not receive isChatOpen or profileBackHref as props (grep its prop type)"
  - "pnpm build --filter=@feel-good/mirror succeeds"
  - "pnpm lint --filter=@feel-good/mirror succeeds"
  - "All e2e tests in profile-content-panel-toggle.spec.ts that pass before this change still pass after"
owner_agent: "React refactoring specialist"
---

# WorkspaceShell delegates route-derivation to a single hook

## Context

Surfaced during review of PR #13 (route-based mobile navigation). `apps/mirror/app/[username]/_components/workspace-shell.tsx:28-87` currently computes:

- `isMobile` (viewport)
- `username` (route param)
- `searchParams` / `segments` (URL primitives)
- `isChatOpen`, `buildChatAwareHref` (chat hook)
- `hasContentRoute` (segment derivation)
- `routeState` (segment derivation, with a clone-settings carve-out — see FG_079)
- `defaultContentHref` (memo over username + searchParams)
- `profileBackHref` (memo over buildChatAwareHref + username)
- `openDefaultContent` (router.push wrapper)

It then renders one of two trees, threading those values as props. Most of those derived values exist *only* to be passed down. `MobileWorkspace` receives `isChatOpen` and `profileBackHref` as props but is itself a client component that could call `useChatSearchParams()` and `useParams()` directly. The shell ends up acting as a router-state pipe.

## Goal

`WorkspaceShell` decides mobile vs desktop and renders the chosen variant. Route-derivation lives in a single hook. `MobileWorkspace` reads its own chat/back-nav state instead of receiving it via props.

## Scope

- Add `apps/mirror/app/[username]/_hooks/use-profile-workspace-route-data.ts` (or co-located file) returning `{ hasContentRoute, routeState, defaultContentHref, profileBackHref, openDefaultContent, isChatOpen }`
- Replace inline derivations in `workspace-shell.tsx` with one call to the hook
- Reduce `MobileWorkspaceProps` by reading `isChatOpen` and the back href via the hook (or via `useChatSearchParams` / `useParams` directly inside the component)
- Confirm `DesktopWorkspace` still receives the same data (props or hook call)

## Out of Scope

- Splitting the `WorkspaceChromeContext` further (separate ticket)
- Pushing the clone-settings carve-out into `getContentRouteState` (covered by FG_079 — this ticket should reuse whatever shape `routeState` has at the time)
- Touching the `useProfileNavigationEffects` hook
- Renaming `WorkspaceShell` or restructuring the parallel-route slots

## Approach

Create a single hook that owns all route-derived workspace data. The hook reads `useParams`, `useSearchParams`, `useSelectedLayoutSegments`, and `useChatSearchParams` once, and returns the memoized derivation. `WorkspaceShell` calls the hook, picks `isMobile`, and renders one variant. `MobileWorkspace` and `DesktopWorkspace` either call the hook themselves or receive a single `routeData` object — whichever produces fewer props at the boundary.

- **Effort:** Medium
- **Risk:** Medium — touches the most-loaded path on profile routes; regressions show up in mobile chat/back nav

## Implementation Steps

1. Create the hook file (suggested: `apps/mirror/app/[username]/_hooks/use-profile-workspace-route-data.ts`). Move `defaultContentHref` memo, `profileBackHref` memo, `routeState` derivation, `hasContentRoute`, and `openDefaultContent` into it. Re-export `isChatOpen` from the same hook for symmetry.
2. Update `workspace-shell.tsx` to call the hook and forward only what each child genuinely needs as props.
3. Update `mobile-workspace.tsx`: drop `isChatOpen` and `profileBackHref` from its prop type. Read them via the hook (or `useChatSearchParams` / `useParams` directly).
4. Update `desktop-workspace.tsx` if its prop surface should also use the hook (optional — desktop already gets only `hasContentRoute` and `onOpenDefaultContent`).
5. Run `pnpm build --filter=@feel-good/mirror` and `pnpm lint --filter=@feel-good/mirror`.
6. Run `pnpm test:e2e profile-content-panel-toggle` and confirm the mobile-back-nav test still passes.
7. Manually verify in Chrome at 390×844: profile root, content route, chat short-circuit, back-arrow round-trip.

## Constraints

- The hook must be a single source of truth — `getContentRouteState`, `isProfileTabKind`, `getContentHref`, and `buildChatAwareHref` must each be called from exactly one place outside their own files
- Do not regress hydration behavior — the shell currently has no SSR/CSR mismatch on this branch; keep it that way
- Do not introduce a new context just to ferry the hook's return value

## Resources

- FG_052 (completed) extracted `defaultContentHref` partially; this ticket consolidates the rest
- FG_055 (completed) addressed the mobile-flash issue from the old redirect — make sure this refactor doesn't reintroduce one
- PR #13 — branch where the junction-box pattern is most visible
