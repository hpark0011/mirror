---
id: FG_077
title: "WorkspaceChromeContext exposes only reactive state, not static IDs"
date: 2026-04-27
type: refactor
status: completed
priority: p3
description: "WorkspaceChromeContext currently exposes contentPanelId and interactionPanelId, but both are static module-level constants exported from workspace-panels.tsx. Plumbing them through context forces every shell (desktop, mobile) to copy them into its chrome value just so consumers can read them back. Consumers should import the constants directly; the context shrinks to actual reactive state (collapse flags, toggles, navbar config)."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "grep -n 'contentPanelId\\|interactionPanelId' apps/mirror/app/\\[username\\]/_providers/workspace-chrome-context.tsx returns 0 matches"
  - "grep -rn 'chrome\\.contentPanelId\\|chrome\\.interactionPanelId\\|chrome?\\.contentPanelId\\|chrome?\\.interactionPanelId' apps/mirror returns 0 matches"
  - "Each of workspace-navbar.tsx, profile-panel.tsx, content-panel-toggle.tsx, and collapsed-profile-avatar-button.tsx imports CONTENT_PANEL_ID or INTERACTION_PANEL_ID directly from ./workspace-panels (or relative equivalent)"
  - "pnpm build --filter=@feel-good/mirror succeeds"
  - "pnpm lint --filter=@feel-good/mirror succeeds"
owner_agent: "React refactoring specialist"
---

# WorkspaceChromeContext exposes only reactive state, not static IDs

## Context

Discovered during review of the route-based mobile navigation refactor (PR #13, follow-up to f19fa712). `apps/mirror/app/[username]/_providers/workspace-chrome-context.tsx:9-18` declares:

```ts
type WorkspaceChromeContextValue = {
  contentPanelId: string;
  isContentPanelCollapsed: boolean;
  toggleContentPanel: () => void;
  interactionPanelId: string;
  isInteractionPanelCollapsed: boolean;
  toggleInteractionPanel: () => void;
  showContentPanelToggle: boolean;
  backHref?: string;
};
```

`contentPanelId` and `interactionPanelId` are constants — they live at `apps/mirror/app/[username]/_components/workspace-panels.tsx:10-11`:

```ts
export const CONTENT_PANEL_ID = "profile-content-panel";
export const INTERACTION_PANEL_ID = "profile-interaction-panel";
```

Both shells (`desktop-workspace.tsx:52-55`, `mobile-workspace.tsx:28-31`) import these constants and put them into the chrome value, only so consumers (`workspace-navbar.tsx:68`, `profile-panel.tsx:55`, `content-panel-toggle.tsx:28`, `collapsed-profile-avatar-button.tsx:17`) can read them back via `chrome.contentPanelId` / `chrome.interactionPanelId` for `aria-controls`. The context is a pass-through middleman for static data.

FG_058 already moved these IDs out of the chrome-context file into `workspace-panels.tsx`. This ticket finishes the job: stop putting them on the context value at all.

## Goal

`WorkspaceChromeContext` carries only reactive state (collapse flags, toggle callbacks, navbar config). Panel IDs are imported directly by the consumers that need them.

## Scope

- Remove `contentPanelId` and `interactionPanelId` fields from `WorkspaceChromeContextValue`
- Remove those fields from the chrome-value objects in `desktop-workspace.tsx` and `mobile-workspace.tsx`
- Update each consumer to import `CONTENT_PANEL_ID` / `INTERACTION_PANEL_ID` directly from `./workspace-panels`

## Out of Scope

- Splitting `WorkspaceChromeContext` further into panel-state vs navbar-config contexts (separate concern, defer)
- Renaming or relocating the panel-ID constants
- Changing the IDs' string values (would invalidate `aria-controls` references)

## Approach

The IDs are import-time constants. Plumbing them through React context is pure ceremony — same on every render, no consumer-specific value, no provider-specific override. Consumers already live in the same monorepo and can import directly.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Edit `apps/mirror/app/[username]/_providers/workspace-chrome-context.tsx`: delete `contentPanelId: string;` and `interactionPanelId: string;` from `WorkspaceChromeContextValue`.
2. Edit `apps/mirror/app/[username]/_components/desktop-workspace.tsx`: drop those two keys from the `workspaceChromeValue` `useMemo` and remove the `CONTENT_PANEL_ID` / `INTERACTION_PANEL_ID` imports if no longer used in this file.
3. Edit `apps/mirror/app/[username]/_components/mobile-workspace.tsx`: same — drop the keys from chrome value, remove imports if dead.
4. Update each consumer to import the constant directly:
   - `apps/mirror/components/workspace-navbar.tsx` — replace `chrome.contentPanelId` with imported `CONTENT_PANEL_ID`
   - `apps/mirror/app/[username]/_components/profile-panel.tsx` — replace `chrome?.interactionPanelId` with `INTERACTION_PANEL_ID`
   - `apps/mirror/app/[username]/_components/content-panel-toggle.tsx` — destructure removes `contentPanelId`; import constant directly
   - `apps/mirror/app/[username]/_components/collapsed-profile-avatar-button.tsx` — replace `chrome.interactionPanelId` with `INTERACTION_PANEL_ID`
5. `pnpm build --filter=@feel-good/mirror` to confirm types.
6. `pnpm lint --filter=@feel-good/mirror` clean.
7. `pnpm test:e2e profile-content-panel-toggle` to confirm aria-controls still resolves.

## Constraints

- Do not change the string values of `CONTENT_PANEL_ID` or `INTERACTION_PANEL_ID` — they're referenced via `aria-controls` on multiple components
- Do not introduce new exports from `workspace-chrome-context.tsx`
- Do not remove the chrome context itself; only the two ID fields

## Resources

- FG_058 (completed) moved these IDs out of the chrome-context file
- PR #13 — branch where this refactor surfaced
