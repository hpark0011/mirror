---
id: FG_082
title: "WorkspaceChromeContext exposes capability flags instead of viewport proxies"
date: 2026-04-27
type: refactor
status: completed
priority: p2
description: "Consumers use useIsMobile() as a proxy for 'does chrome have a collapse affordance?'. This conflates viewport with capability. FG_080 relocated the close-X consumer but kept the underlying coupling — WorkspaceInteractionPanel still relies on chrome being present (mobile = absent) as the implicit capability check. Add explicit canCollapseInteractionPanel and canCollapseContentPanel flags so consumers ask the right question."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "grep -n 'canCollapseInteractionPanel\\|canCollapseContentPanel' apps/mirror/app/\\[username\\]/_providers/workspace-chrome-context.tsx returns at least 2 matches (both flags declared on WorkspaceChromeContextValue)"
  - "grep -n 'canCollapseInteractionPanel: true\\|canCollapseContentPanel: true' apps/mirror/app/\\[username\\]/_components/desktop-workspace.tsx returns at least 2 matches"
  - "grep -n 'canCollapseInteractionPanel\\|canCollapseContentPanel' apps/mirror/app/\\[username\\]/_components/mobile-workspace.tsx returns 0 matches OR returns matches setting both to false"
  - "The close-button render condition in WorkspaceInteractionPanel (apps/mirror/app/\\[username\\]/_components/workspace-panels.tsx) reads chrome?.canCollapseInteractionPanel rather than relying solely on chrome presence"
  - "pnpm build --filter=@feel-good/mirror succeeds"
  - "pnpm lint --filter=@feel-good/mirror succeeds"
owner_agent: "React refactoring specialist"
---

# WorkspaceChromeContext exposes capability flags instead of viewport proxies

## Context

Surfaced during FG_080 (completed) and the meta-discussion that produced FG_082–FG_084. The repo currently uses `useIsMobile()` from `@feel-good/ui/hooks/use-mobile` as a proxy for two unrelated questions: "what's the viewport?" and "does chrome have a collapse affordance?". They happen to correlate today (desktop has collapse, mobile doesn't) but the correlation is incidental.

`apps/mirror/app/[username]/_components/workspace-panels.tsx:74-100` (after FG_080) renders the close-X button based on `chrome` being present and `!chrome.isInteractionPanelCollapsed`. Mobile renders the panel without providing chrome, so the X never appears — but that's a side effect of "mobile doesn't mount the chrome provider," not an explicit capability check. If a future desktop layout (focus mode, zen mode, etc.) ships without collapse panels, every consumer that uses viewport-as-proxy or chrome-presence-as-proxy breaks silently with no compile-time signal.

The chrome context (`apps/mirror/app/[username]/_providers/workspace-chrome-context.tsx`) currently exposes the *mechanism* (`toggleInteractionPanel`, `isInteractionPanelCollapsed`) but not the *capability* (whether the affordance is even available).

## Goal

`WorkspaceChromeContextValue` exposes explicit `canCollapseInteractionPanel: boolean` and `canCollapseContentPanel: boolean` flags. Consumers gate chrome affordances on the capability flag rather than on viewport detection or chrome-provider presence. The close-X render condition in `WorkspaceInteractionPanel` reads the flag.

## Scope

- Add `canCollapseInteractionPanel: boolean` and `canCollapseContentPanel: boolean` to `WorkspaceChromeContextValue` in `apps/mirror/app/[username]/_providers/workspace-chrome-context.tsx`.
- Set both `true` in `desktop-workspace.tsx`'s `workspaceChromeValue`.
- Set both `false` in `mobile-workspace.tsx`'s chrome value (or omit and treat absence as false at the consumer).
- Update the close-X render gate in `WorkspaceInteractionPanel` to read `chrome?.canCollapseInteractionPanel` instead of relying on chrome presence alone.

## Out of Scope

- Viewport-only layout decisions (e.g. profile-panel.tsx's `pt-24` vs `py-[132px]` className branch — covered by FG_083)
- Renaming or restructuring `WorkspaceChromeContext` itself
- Adding capability flags for affordances that don't exist yet
- Migrating the rest of the `useIsMobile` call sites that aren't chrome-decisions

## Approach

The flag is a static descriptor of the chrome variant: desktop = `true`, mobile = `false` (or absent). Consumers read it the same way they read other chrome state. The close-X render condition in `WorkspaceInteractionPanel` becomes `chrome?.canCollapseInteractionPanel && !chrome.isInteractionPanelCollapsed` — explicit about both the capability and the current state.

- **Effort:** Small
- **Risk:** Low — additive change to chrome context, single consumer migration

## Implementation Steps

1. Edit `apps/mirror/app/[username]/_providers/workspace-chrome-context.tsx`: add `canCollapseInteractionPanel: boolean` and `canCollapseContentPanel: boolean` to `WorkspaceChromeContextValue`.
2. Edit `apps/mirror/app/[username]/_components/desktop-workspace.tsx`: add both flags as `true` in the `workspaceChromeValue` `useMemo`.
3. Edit `apps/mirror/app/[username]/_components/mobile-workspace.tsx`: add both flags as `false` (or document why they're omitted).
4. Edit `apps/mirror/app/[username]/_components/workspace-panels.tsx`: update the close-X render gate in `WorkspaceInteractionPanel` to check `chrome?.canCollapseInteractionPanel` in addition to existing checks.
5. `pnpm build --filter=@feel-good/mirror` to confirm types.
6. `pnpm lint --filter=@feel-good/mirror`.
7. Manually verify at 1280×800: close-X still renders and toggles. At 390×844: close-X does not render.

## Constraints

- Do not rename `WorkspaceChromeContext` or restructure existing fields
- Do not change the visual behavior of the close-X (still renders only when collapse is available and the panel isn't already collapsed)
- The flags must be serializable booleans — no functions, no derived state in the value

## Resources

- FG_080 (completed) — relocated the close-X but didn't address the capability vs viewport conflation
- The meta-discussion produced FG_082, FG_083, and FG_084 as a coherent cleanup of the `useIsMobile`-as-proxy pattern
