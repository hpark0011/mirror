---
id: FG_050
title: "Profile scroll state is isolated per content kind"
date: 2026-03-08
type: fix
status: to-do
priority: p2
description: "The right-panel scroll restoration logic currently stores one global list/detail scroll position, so article navigation state can leak into the posts feed and vice versa when switching content kinds."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "`rg -n 'routeState\\.kind|contentKind' apps/mirror/app/\\[username\\]/_components/workspace-shell.tsx apps/mirror/app/\\[username\\]/_components/content-panel.tsx apps/mirror/app/\\[username\\]/_components/mobile-workspace.tsx apps/mirror/hooks/use-profile-navigation-effects.ts` returns matches."
  - "`rg -n 'const savedScrollTop = useRef\\(0\\)' apps/mirror/hooks/use-profile-navigation-effects.ts` returns no matches."
  - "`pnpm build --filter=@feel-good/mirror` succeeds."
  - "`pnpm -C apps/mirror exec playwright test e2e/article-navigation.spec.ts` succeeds."
owner_agent: "Route-state and scroll-restoration specialist"
---

# Profile scroll state is isolated per content kind

## Context

Architecture review found that both `apps/mirror/app/[username]/_components/content-panel.tsx` and `apps/mirror/app/[username]/_components/mobile-workspace.tsx` create one shared scroll container for the right panel, while `apps/mirror/hooks/use-profile-navigation-effects.ts` stores a single `savedScrollTop` value for all content transitions.

Because the hook only knows `"list"` versus `"detail"`, scroll restoration can restore article-list state when the user is actually returning to posts, or preserve the previous tab's scroll position across content-kind switches. That violates the intended “persist within a kind” behavior for the new multi-type right panel.

## Goal

Scope right-panel scroll restoration to the active content kind so switching between articles and posts does not reuse another kind's saved navigation state.

## Scope

- Extend the scroll effect contract to include content-kind awareness.
- Update desktop and mobile workspace callsites to pass kind-aware route state.
- Add or adjust regression coverage for cross-kind navigation behavior.

## Out of Scope

- Reworking chat route composition.
- Changing the visual design of the workspace shell.
- Adding new content kinds beyond `articles` and `posts`.

## Approach

Pass kind-aware route data into `useProfileNavigationEffects` and store navigation state per content kind instead of in one global ref. The hook should only restore saved scroll when returning within the same kind, and kind switches should start from the correct default state rather than inheriting the previous tab's position.

- **Effort:** Medium
- **Risk:** Medium

## Implementation Steps

1. Update `apps/mirror/hooks/use-profile-navigation-effects.ts` so its API can distinguish articles from posts when saving and restoring scroll state.
2. Update `apps/mirror/app/[username]/_components/workspace-shell.tsx`, `apps/mirror/app/[username]/_components/content-panel.tsx`, and `apps/mirror/app/[username]/_components/mobile-workspace.tsx` to pass kind-aware route input into the hook.
3. Ensure list-to-detail back navigation still restores scroll within a single content kind.
4. Add or update `apps/mirror/e2e/article-navigation.spec.ts` coverage for switching between articles and posts without leaking scroll state.
5. Run `pnpm build --filter=@feel-good/mirror`.
6. Run `pnpm -C apps/mirror exec playwright test e2e/article-navigation.spec.ts`.

## Constraints

- Keep chat behavior unchanged.
- Do not reintroduce pathname-regex route inference into the scroll hook.
- Preserve current list/detail restoration semantics for article-only navigation.

## Resources

- `apps/mirror/hooks/use-profile-navigation-effects.ts`
- `apps/mirror/app/[username]/_components/workspace-shell.tsx`
- `apps/mirror/app/[username]/_components/content-panel.tsx`
- `apps/mirror/app/[username]/_components/mobile-workspace.tsx`
- `apps/mirror/e2e/article-navigation.spec.ts`
