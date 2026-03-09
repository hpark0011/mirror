---
id: FG_055
title: "Mobile profile root avoids layout flash before redirect"
date: 2026-03-09
type: fix
status: completed
priority: p2
description: "useMediaQuery initializes with useState(false), so mobile users see one frame of desktop layout, then blank (return null), then content after router.replace. This causes two layout shifts before meaningful content on the mobile profile root."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "Mobile viewport profile root does not flash desktop layout before redirecting (verify via e2e screenshot or manual test)"
  - "Desktop profile root still renders correctly with collapsed panel"
  - "pnpm build --filter=@feel-good/mirror succeeds"
owner_agent: "SSR/hydration specialist"
---

# Mobile profile root avoids layout flash before redirect

## Context

In `apps/mirror/app/[username]/_components/workspace-shell.tsx:47-54`, when `isMobile` is false (initial render) and then flips to true (after `useMediaQuery` effect), mobile users experience: desktop layout flash → blank (`return null`) → content (after `router.replace`). The `useMediaQuery` hook in `@feel-good/ui/hooks/use-mobile` initializes with `useState(false)`, so the first client render always assumes desktop.

The server component `page.tsx` already does UA detection and redirects mobile users, which covers the initial page load. But client-side navigations to the profile root bypass the server component, hitting this code path.

## Goal

Mobile users see no desktop layout flash when navigating to the profile root, regardless of whether it's an initial load or client-side navigation.

## Scope

- Investigate `useMediaQuery` / `useIsMobile` initialization
- Consider CSS-based visibility as an alternative to JS-based conditional rendering
- Fix the flash for client-side navigations

## Out of Scope

- Changing the server-side UA detection in `page.tsx`
- Rewriting useMediaQuery for all consumers
- SSR framework changes

## Approach

The simplest approach may be to add a CSS class that hides the workspace shell content until the media query resolves, or to use `useSyncExternalStore` with a server snapshot for `useMediaQuery`. Another option: since the server component already handles the initial load redirect, the client-side flash only matters for SPA navigations — a brief loading state may be acceptable. Needs investigation.

- **Effort:** Medium
- **Risk:** Medium

## Implementation Steps

1. Investigate `useIsMobile` / `useMediaQuery` implementation in `@feel-good/ui/hooks/`
2. Determine if `useSyncExternalStore` can provide correct initial value
3. Alternatively, add a CSS-only visibility gate (e.g., `hidden md:block` on desktop wrapper)
4. Test on mobile viewport with e2e or Chrome DevTools device mode
5. Run `pnpm build --filter=@feel-good/mirror`

## Constraints

- Must not break desktop behavior
- Must not cause hydration mismatch warnings
- Solution should work for both initial page load and client-side navigation

## Resources

- `apps/mirror/app/[username]/_components/workspace-shell.tsx:47-54`
- `@feel-good/ui/hooks/use-mobile` (useIsMobile implementation)
