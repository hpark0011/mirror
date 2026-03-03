---
id: FG_045
title: "Profile scroll effects derive mode from explicit route input"
date: 2026-03-03
type: refactor
status: completed
priority: p2
description: "Profile navigation scroll effects still infer article/detail transitions from pathname regex, coupling behavior to rewritten URL shape instead of explicit route mode from layout-level routing state."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "`rg -n 'usePathname|isArticleDetailRoute' apps/mirror/hooks/use-profile-navigation-effects.ts` returns no matches."
  - "`rg -n 'routeMode' apps/mirror/hooks/use-profile-navigation-effects.ts` returns at least one match."
  - "`rg -n 'routeMode' apps/mirror/app/\\[username\\]/_components/content-panel.tsx apps/mirror/app/\\[username\\]/_components/mobile-workspace.tsx` returns matches showing explicit mode passed into the hook."
  - "`pnpm -C apps/mirror build` succeeds."
owner_agent: "Route-state and scroll-behavior refactor specialist"
---

# Profile scroll effects derive mode from explicit route input

## Context

`apps/mirror/hooks/use-profile-navigation-effects.ts` still computes detail/list transitions from pathname regex (`/@username/...` and chat exclusions). The architecture moved to route-driven slots, but this hook still depends on URL pattern parsing.

This creates residual coupling to rewrite/path conventions and makes behavior harder to reason about compared to explicit mode contracts from layout/shell components.

The issue was found in post-refactor architecture review as a remaining gap after removing `ProfileShell`.

## Goal

Make scroll restoration logic route-mode driven through explicit inputs so it is no longer dependent on pathname regex interpretation.

## Scope

- Refactor `useProfileNavigationEffects` to accept explicit route mode input.
- Update mobile and desktop callsites to pass mode directly.
- Keep existing list/detail scroll preservation behavior.

## Out of Scope

- Changing visual layout or animation behavior.
- Modifying article content rendering.
- Reworking route rewrites in `next.config.ts`.

## Approach

Replace pathname-based inference with a small explicit contract, e.g. `{ routeMode: "list" | "detail" | "chat", scrollContainer }`. Let callsites determine route mode from segment data they already own, and keep the hook focused on scroll bookkeeping.

- **Effort:** Medium
- **Risk:** Medium

## Implementation Steps

1. Refactor `apps/mirror/hooks/use-profile-navigation-effects.ts` to remove pathname parsing and accept explicit mode.
2. Update `apps/mirror/app/[username]/_components/content-panel.tsx` to pass list/detail mode.
3. Update `apps/mirror/app/[username]/_components/mobile-workspace.tsx` to pass explicit mode for mobile behavior.
4. Confirm chat routes do not trigger article detail scroll restoration.
5. Run `pnpm -C apps/mirror build`.

## Constraints

- Preserve current user-visible scroll behavior for article list/detail transitions.
- Avoid introducing route regex parsing in new hook code.
- Keep API surface minimal and local to route workspace components.

## Resources

- `apps/mirror/hooks/use-profile-navigation-effects.ts`
- `apps/mirror/app/[username]/_components/content-panel.tsx`
- `apps/mirror/app/[username]/_components/mobile-workspace.tsx`
