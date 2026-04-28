---
id: FG_080
title: "Close-profile button lives in the desktop interaction-panel chrome"
date: 2026-04-27
type: refactor
status: completed
priority: p2
description: "ProfilePanel currently branches on useIsMobile to decide whether to render the close-profile (X) button — a desktop-only collapse affordance that has no place inside the panel content. The flag has caused churn (commit facabb3f) and couples ProfilePanel to viewport width. Move the close-profile button into WorkspaceInteractionPanel (the desktop wrapper that already owns collapse semantics) so ProfilePanel stops importing useIsMobile."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "grep -n 'chrome?\\.toggleInteractionPanel\\|chrome?\\.interactionPanelId\\|chrome\\.toggleInteractionPanel\\|chrome\\.interactionPanelId\\|useOptionalWorkspaceChrome' apps/mirror/app/\\[username\\]/_components/profile-panel.tsx returns 0 matches (chrome decisions removed; remaining useIsMobile usage governs the pt-24/py-[132px] layout branch only, which is explicitly out of scope per Scope and Out of Scope)"
  - "grep -n 'XmarkIcon\\|Close profile' apps/mirror/app/\\[username\\]/_components/profile-panel.tsx returns 0 matches"
  - "grep -rn 'Close profile' apps/mirror/app/\\[username\\]/_components/workspace-panels.tsx returns at least 1 match"
  - "Desktop close button still toggles the interaction panel (manually verified at >=1024px viewport)"
  - "Mobile profile root (390×844) does not render the close button (manually verified)"
  - "pnpm build --filter=@feel-good/mirror succeeds"
  - "pnpm lint --filter=@feel-good/mirror succeeds"
owner_agent: "React refactoring specialist"
---

# Close-profile button lives in the desktop interaction-panel chrome

## Context

`apps/mirror/app/[username]/_components/profile-panel.tsx:11, :21, :33-35, :54-68` uses `useIsMobile` for two separate purposes:

1. Picking a different className (`pt-24` mobile vs `py-[132px]` desktop)
2. Hiding the close-profile (X) button on mobile

The close button is desktop-only collapse chrome — it triggers `chrome?.toggleInteractionPanel`, which on mobile is a NOOP (`mobile-workspace.tsx:31`). The recent commit `facabb3f` ("hide close profile button on mobile") tried to patch this in-content. The cleaner location is `WorkspaceInteractionPanel` at `apps/mirror/app/[username]/_components/workspace-panels.tsx:74` — that wrapper is desktop-only (only used in `desktop-workspace.tsx:73-81`) and already owns the panel's collapse identity.

ProfilePanel's first `useIsMobile` use (the className branch) is also a smell, but it's an actual layout difference and out of scope here.

## Goal

The close-profile button is rendered by the desktop chrome that wraps `ProfilePanel`, not by `ProfilePanel` itself. `ProfilePanel` no longer imports `useIsMobile` for chrome decisions and no longer reads `chrome?.toggleInteractionPanel` / `chrome?.interactionPanelId`.

## Scope

- Move the `<IconButton aria-label="Close profile panel" ...>` element from `profile-panel.tsx:54-68` into `WorkspaceInteractionPanel` in `workspace-panels.tsx`
- Position it absolutely (top-3, right-3) over the panel's children — same visual location as today
- Remove the `useIsMobile` close-button gate from `ProfilePanel`
- Confirm the className branch (`pt-24` vs `py-[132px]`) is the only remaining use of `useIsMobile` in `ProfilePanel` (or remove that import entirely if also gone)

## Out of Scope

- Replacing the `pt-24` / `py-[132px]` className branch with anything fancier (CSS container queries, etc.)
- Restyling the close button
- Changing `WorkspaceInteractionPanel`'s API to accept a custom chrome slot
- Mobile chat-close UX (separate concern; chat already has its own header)

## Approach

`WorkspaceInteractionPanel` already wraps the panel content. Render the close button as an absolutely-positioned overlay inside that wrapper, reading `useOptionalWorkspaceChrome` to get `toggleInteractionPanel` / `isInteractionPanelCollapsed` (and `INTERACTION_PANEL_ID` directly per FG_077, if landed). Mobile never reaches this code path because `MobileWorkspace` doesn't render `WorkspaceInteractionPanel`.

- **Effort:** Medium
- **Risk:** Medium — accessibility-relevant button (aria-controls, aria-expanded, aria-label) needs to keep its semantics

## Implementation Steps

1. In `workspace-panels.tsx`, modify `WorkspaceInteractionPanel` to render the close button as an absolutely-positioned overlay (top-3, right-3) above its children. Read the same chrome fields the old button used.
2. Delete the close-button JSX block and its `chrome` lookup from `profile-panel.tsx`. If `useIsMobile` becomes unused, drop the import; if still used for the className branch, leave it.
3. `pnpm build --filter=@feel-good/mirror` and `pnpm lint --filter=@feel-good/mirror`.
4. Manually verify at 1280×800: close button visible, click toggles interaction panel, aria-expanded/controls correct.
5. Manually verify at 390×844: no close button visible on profile root or content route.
6. Manually verify desktop chat (`?chat=1`): the close button on the chat panel itself is unaffected (it's a separate component).

## Constraints

- Aria attributes (`aria-controls={INTERACTION_PANEL_ID}`, `aria-expanded`, `aria-label="Close profile panel"`) must be preserved on the relocated button
- The close button must only be reachable on desktop (no `useIsMobile` re-introduction at the new location)
- Do not regress chat-panel close behavior — chat has its own dismiss path

## Resources

- Commit `facabb3f` — context for the previous fix
- PR #13 — current location of the broken-into-two-purposes `useIsMobile`
