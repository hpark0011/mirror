---
id: FG_084
title: "EditProfileButton lives in the desktop interaction-panel chrome"
date: 2026-04-27
type: refactor
status: to-do
priority: p3
description: "After FG_080, the close-X lives in WorkspaceInteractionPanel chrome but EditProfileButton still lives inside ProfilePanel content. Their positions are now coupled implicitly — profile-panel hardcodes right-14 to leave room for chrome's right-3 X, with a comment documenting the dependency. ProfilePanel shouldn't have to know about chrome's button positions. Move EditProfileButton into the chrome wrapper alongside the close-X."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "grep -n 'EditProfileButton\\|EditActions' apps/mirror/app/\\[username\\]/_components/profile-panel.tsx returns 0 matches"
  - "grep -n 'right-14' apps/mirror/app/\\[username\\]/_components/profile-panel.tsx returns 0 matches"
  - "grep -n 'EditProfileButton\\|EditActions' apps/mirror/app/\\[username\\]/_components/workspace-panels.tsx returns at least 2 matches"
  - "WorkspaceInteractionPanel renders EditProfileButton/EditActions and the close-X as siblings in a flex row anchored at top-3 right-3 (matches the pre-FG_080 visual)"
  - "Edit mode still works end-to-end: clicking pencil enters edit mode, EditActions cancel button appears, cancel exits edit mode (manually verified at 1280×800 via Chrome MCP)"
  - "pnpm build --filter=@feel-good/mirror succeeds"
  - "pnpm lint --filter=@feel-good/mirror succeeds"
owner_agent: "React refactoring specialist"
---

# EditProfileButton lives in the desktop interaction-panel chrome

## Context

FG_080 (completed) moved the close-X button from `apps/mirror/app/[username]/_components/profile-panel.tsx` into `WorkspaceInteractionPanel` (in `workspace-panels.tsx`). To prevent the X from overlapping the existing EditProfileButton, that PR also offset the EditProfileButton container from `top-3 right-3` to `top-3 right-14`, with a comment in `profile-panel.tsx` explaining the dependency on the chrome's `right-3` close button.

That offset is a code smell: ProfilePanel now has to know about chrome's button positions. Both buttons are desktop-only top-right affordances on the same panel — both belong in the same container. The structurally clean answer is "all desktop-only chrome affordances live in chrome." This ticket finishes what FG_080 started.

The remaining ProfilePanel state to move is the edit-mode toggle (`isEditing`, `setIsEditing`, `isSubmitting`, `setIsSubmitting`). Currently those are local `useState` in ProfilePanel. To move EditProfileButton into chrome, the toggle state needs to be reachable from chrome — most naturally via a context (extending `ProfileRouteDataContext` or adding an edit-mode context).

## Goal

EditProfileButton (and EditActions) render as a chrome overlay on the interaction panel, alongside the close-X, in a single flex row anchored at top-3 right-3 (matching the pre-FG_080 visual). ProfilePanel stops rendering EditProfileButton/EditActions and stops hardcoding offsets that depend on chrome's button positions.

## Scope

- Lift the edit-mode state (`isEditing`, `setIsEditing`, `isSubmitting`, `setIsSubmitting`) into a context reachable from `WorkspaceInteractionPanel`. Extending `ProfileRouteDataContext` is the most natural home (it already carries owner-aware profile state).
- Move the EditProfileButton/EditActions JSX from `profile-panel.tsx` into `WorkspaceInteractionPanel` in `workspace-panels.tsx`, alongside the close-X. Render both as siblings in a flex row at top-3 right-3 with `gap-1.5` (matches the pre-FG_080 visual order).
- Drop the `right-14` offset and its dependency comment from `profile-panel.tsx`.
- ProfileInfo's `isEditing` / `onEditComplete` / `onSubmittingChange` props still need their state — wire them to the lifted context inside ProfilePanel.

## Out of Scope

- Introducing a state-management library (Zustand, Redux, etc.) — context is sufficient
- Changing the edit-mode UX (still pencil → enter edit mode → EditActions cancel exits)
- Mobile layout (mobile doesn't render WorkspaceInteractionPanel; mobile edit-mode entry point is unchanged)
- Restyling EditProfileButton, the X, or EditActions
- Changes to ProfileRouteDataContext beyond adding the edit-mode field(s)

## Approach

1. Add `isEditing`, `setIsEditing`, `isSubmitting`, `setIsSubmitting` to `ProfileRouteDataContext` (or a new `ProfileEditModeContext` if that context is becoming overstuffed). The provider for this state should wrap both ProfilePanel and WorkspaceInteractionPanel — typically that's the `WorkspaceShell` level or the chrome's parallel-route layout.
2. WorkspaceInteractionPanel reads the context, renders EditProfileButton/EditActions overlay (top-3 right-3 flex row, alongside the close-X). The render condition: `isOwner && isEditing ? <EditActions /> : <EditProfileButton />`, plus the close-X on its right.
3. ProfilePanel reads the same context for ProfileInfo's `isEditing` / `onEditComplete` / `onSubmittingChange` props; drops its own `useState` and the EditProfileButton/EditActions container.

- **Effort:** Medium
- **Risk:** Medium — touches the owner-edit flow, which has implicit edge cases (canceling mid-submit, enter/exit timing); chrome's z-index relative to ProfilePanel content also matters

## Implementation Steps

1. Inspect `apps/mirror/app/[username]/_providers/profile-route-data-context.tsx` (or wherever `ProfileRouteDataContext` lives — verify with `grep -rn 'ProfileRouteData' apps/mirror`). Add `isEditing`, `setIsEditing`, `isSubmitting`, `setIsSubmitting` to the value type. Initialize with `useState` in the provider.
2. Update the provider's hierarchy if needed so both `WorkspaceInteractionPanel` (rendered by `desktop-workspace.tsx`) and `ProfilePanel` are descendants of the same provider instance. They likely already are via the parallel-route layout — verify.
3. Edit `apps/mirror/app/[username]/_components/workspace-panels.tsx`: in `WorkspaceInteractionPanel`, add EditProfileButton/EditActions JSX as a sibling of the close-X inside a flex row at top-3 right-3 with `gap-1.5`. Read `useProfileRouteData()` for `isOwner`, `isEditing`, etc. Preserve aria attributes.
4. Edit `apps/mirror/app/[username]/_components/profile-panel.tsx`: remove the EditProfileButton/EditActions container (the `<div className="absolute top-3 right-14 ...">` block). Drop `EditProfileButton` and `EditActions` imports if unused. Replace ProfilePanel's local `useState` for `isEditing`/`isSubmitting` with reads from `useProfileRouteData()`.
5. `pnpm build --filter=@feel-good/mirror`.
6. `pnpm lint --filter=@feel-good/mirror`.
7. Chrome MCP at 1280×800 on `/@hpark0011/posts`: confirm pencil + X side-by-side (pencil left, X right), click pencil → EditActions appears, click cancel → returns to non-edit state.

## Constraints

- Aria attributes on EditProfileButton, EditActions, and the close-X must be preserved
- Mobile (`MobileWorkspace`) does not render `WorkspaceInteractionPanel`; mobile EditProfileButton entry point should remain unchanged. If the mobile layout currently relies on ProfilePanel rendering the edit button, the mobile edit affordance needs an alternative path before this ticket can land
- Edit-mode state should not flicker during the move — the lifted context must be initialized before ProfilePanel mounts
- No state-management library; React context only

## Resources

- FG_080 (completed) — created the split-container coupling and the `right-14` offset this ticket resolves
- FG_082 — companion ticket on chrome capability flags; if landed first, the EditProfileButton render gate can also use `chrome?.canCollapseInteractionPanel` for "this is the desktop variant" rather than checking chrome presence
