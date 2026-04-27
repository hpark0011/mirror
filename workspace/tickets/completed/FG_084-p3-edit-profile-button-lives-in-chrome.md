---
id: FG_084
title: "EditProfileButton lives in the desktop interaction-panel chrome"
date: 2026-04-27
type: refactor
status: completed
priority: p3
description: "After FG_080, the close-X lives in WorkspaceInteractionPanel chrome but EditProfileButton still lives inside ProfilePanel content. Their desktop positions are coupled implicitly — profile-panel hardcodes right-14 to leave room for chrome's right-3 X, with a comment documenting the dependency. ProfilePanel shouldn't have to know about chrome's button positions on desktop. Move the desktop EditProfileButton/EditActions mount into the chrome wrapper alongside the close-X. Mobile keeps its in-panel mount (gated md:hidden) because mobile bare-profile has no chrome surface to relocate to. State already lifted by FG_085."
dependencies: [FG_085]
parent_plan_id:
acceptance_criteria:
  - "grep -n 'EditProfileButton\\|EditActions' apps/mirror/app/\\[username\\]/_components/workspace-panels.tsx returns at least 2 matches (chrome now renders the buttons)"
  - "WorkspaceInteractionPanel renders EditProfileButton/EditActions and the close-X as siblings in a single flex row anchored at top-3 right-3 with gap-1.5 (matches the pre-FG_080 desktop visual)"
  - "grep -n 'right-14' apps/mirror/app/\\[username\\]/_components/profile-panel.tsx returns 0 matches (offset gone — no sibling chrome button to dodge on mobile)"
  - "grep -n \"chrome's close-profile button\\|close-profile button\" apps/mirror/app/\\[username\\]/_components/profile-panel.tsx returns 0 matches (the chrome-position dependency comment is removed)"
  - "Any EditProfileButton/EditActions container that remains in profile-panel.tsx is wrapped in a parent with md:hidden in its className (mobile-only mount). Verify by reading profile-panel.tsx and confirming the JSX shape."
  - "Edit mode round trip via Chrome MCP at 1280x800 (desktop, chrome mount) and 390x844 (mobile, in-panel md:hidden mount): pencil enters edit mode, EditActions Back exits edit mode, no flicker, no double-rendering"
  - "pnpm build --filter=@feel-good/mirror and pnpm lint --filter=@feel-good/mirror both succeed"
owner_agent: "React refactoring specialist"
---

# EditProfileButton lives in the desktop interaction-panel chrome

## Context

FG_080 (completed) moved the close-X button from `apps/mirror/app/[username]/_components/profile-panel.tsx` into `WorkspaceInteractionPanel` (in `workspace-panels.tsx`). To prevent the X from overlapping the existing EditProfileButton, that PR also offset the EditProfileButton container from `top-3 right-3` to `top-3 right-14`, with a comment in `profile-panel.tsx` explaining the dependency on the chrome's `right-3` close button.

That offset is a code smell on desktop: ProfilePanel has to know about chrome's button positions. Both buttons are desktop top-right affordances on the same panel — both belong in the same container. The structurally clean answer is "all desktop chrome affordances live in chrome." This ticket finishes what FG_080 started, **for the desktop variant only**.

Mobile is a different shape. `MobileWorkspace` (`apps/mirror/app/[username]/_components/mobile-workspace.tsx`) does not render `WorkspaceInteractionPanel` — it renders the `interaction` slot directly, so on mobile bare-profile there is no chrome surface to relocate the button onto. `WorkspaceNavbar` exists only inside `ContentPanel` (mobile content routes), which the bare-profile route doesn't show. Mobile's only viable mount point today is inside `ProfilePanel` itself. This ticket therefore keeps the mobile mount inside `ProfilePanel` but gates it `md:hidden`, so the desktop coupling is fully removed and the mobile mount is structurally independent of chrome (no chrome sibling means no offset, no dependency comment).

The edit-mode state was lifted into `ProfileRouteDataContext` by FG_085 (completed). Both `ProfilePanel` and `WorkspaceInteractionPanel` are descendants of `ProfileRouteDataProvider` (mounted at `apps/mirror/app/[username]/layout.tsx:86-94`), so both can read and write `isEditing` / `setIsEditing` / `isSubmitting` / `setIsSubmitting` directly via `useProfileRouteData()`.

## Goal

On desktop: `EditProfileButton`/`EditActions` render as a chrome overlay inside `WorkspaceInteractionPanel`, alongside the close-X, in a single flex row anchored at top-3 right-3 with `gap-1.5` (matching the pre-FG_080 visual). On mobile: `EditProfileButton`/`EditActions` continue to render inside `ProfilePanel`, but the container is gated `md:hidden` so it doesn't render alongside the chrome mount on desktop. The `right-14` offset and the chrome-position dependency comment are gone from `ProfilePanel`. Edit-mode UX is bit-for-bit identical at both viewports.

## Scope

- Add EditProfileButton/EditActions JSX to `WorkspaceInteractionPanel` in `apps/mirror/app/[username]/_components/workspace-panels.tsx`, alongside the existing close-X, as siblings inside a single flex row at `top-3 right-3` with `gap-1.5`. Read `isOwner`, `isEditing`, `setIsEditing`, `setIsSubmitting` from `useProfileRouteData()`. Render `<EditActions ...>` when `isOwner && isEditing`, otherwise `<EditProfileButton onClick={() => setIsEditing(true)} />`. The close-X stays at the right end of the row (matching the pre-FG_080 left-to-right order: pencil/edit-actions, then close-X).
- In `apps/mirror/app/[username]/_components/profile-panel.tsx`: change the existing EditProfileButton/EditActions container className from `absolute top-3 right-14 z-10 flex items-center gap-1.5` to `md:hidden absolute top-3 right-3 z-10 flex items-center gap-1.5` (drop the right-14 offset, gate as mobile-only).
- Remove the "Offset to leave room for the chrome's close-profile button" comment in `profile-panel.tsx`.
- The chrome's EditActions onCancel handler should call `setIsEditing(false)` and `setIsSubmitting(false)` (inline lambda or a small useCallback in WorkspaceInteractionPanel — pick whichever keeps the file readable). Same shape as ProfilePanel's existing `handleEditClose`.

## Out of Scope

- Lifting state — already done in FG_085
- Introducing a state-management library (Zustand, Redux, etc.) — context is sufficient
- Changing the edit-mode UX (still pencil → enter edit mode → EditActions Back exits)
- Adding a mobile chrome surface (top bar, navbar mount on bare-profile, FAB) — mobile keeps its current in-panel mount, just gated `md:hidden`
- Restyling EditProfileButton, the close-X, or EditActions
- Further changes to `ProfileRouteDataContext` (the four edit-mode fields are already there from FG_085)

## Approach

1. `WorkspaceInteractionPanel` (in `workspace-panels.tsx`) currently renders a single button (the close-X) absolutely positioned at `top-3 right-3`. Wrap that close-X plus the new `EditProfileButton`/`EditActions` in a single flex row container at `top-3 right-3 gap-1.5`, with the pencil/EditActions on the left and the close-X on the right. The edit buttons render only when `isOwner` is true (read from `useProfileRouteData()`). The render condition inside the row: `isOwner && isEditing ? <EditActions ... /> : isOwner ? <EditProfileButton onClick={() => setIsEditing(true)} /> : null`, then always the close-X (gated on its existing `chrome?.canCollapseInteractionPanel && !chrome.isInteractionPanelCollapsed` from FG_082).
2. In `profile-panel.tsx`, change the existing absolute container from `top-3 right-14` to `md:hidden absolute top-3 right-3` and remove the chrome-position dependency comment. The container's children (EditProfileButton/EditActions) are unchanged. The state reads (`isEditing`, `setIsEditing`, `isSubmitting`, `setIsSubmitting` from `useProfileRouteData()`) are unchanged from FG_085.
3. Verify no double-rendering: at `md+` (≥768px) the chrome mount renders, the in-panel mount is hidden via `md:hidden`. At `<md` only `MobileWorkspace` mounts, which doesn't render `WorkspaceInteractionPanel`, so only the in-panel mount renders.

- **Effort:** Small (state already lifted by FG_085)
- **Risk:** Low/Medium — touches the owner-edit flow visible at both viewports; the failure mode is double-rendering at one breakpoint or a flicker on toggle. Both manifest immediately on first interaction.

## Implementation Steps

1. Edit `apps/mirror/app/[username]/_components/workspace-panels.tsx` (`WorkspaceInteractionPanel`):
   - Import `useProfileRouteData` from `../_providers/profile-route-data-context`, and `EditActions` + `EditProfileButton` from `@/features/profile`.
   - Inside the component, call `useProfileRouteData()` and destructure `isOwner`, `isEditing`, `setIsEditing`, `setIsSubmitting`.
   - Replace the existing close-X JSX block with a single flex row container (`absolute top-3 right-3 z-10 flex items-center gap-1.5`) that holds, in order: the EditActions/EditProfileButton conditional (only when `isOwner`), then the close-X (with its existing render gate from FG_082).
   - Define a small inline cancel handler for EditActions: `() => { setIsEditing(false); setIsSubmitting(false); }` (or wrap in `useCallback` if the file reads cleaner).
   - Preserve aria attributes on each button.
2. Edit `apps/mirror/app/[username]/_components/profile-panel.tsx`:
   - Change the existing `<div className="absolute top-3 right-14 z-10 flex items-center gap-1.5">` to `<div className="md:hidden absolute top-3 right-3 z-10 flex items-center gap-1.5">`.
   - Remove the `// Offset to leave room for the chrome's close-profile button at right-3 (see WorkspaceInteractionPanel)` comment that sits above the container.
   - Leave the EditProfileButton/EditActions JSX inside the container untouched — it still reads from the lifted context (FG_085).
3. Run `pnpm build --filter=@feel-good/mirror`.
4. Run `pnpm lint --filter=@feel-good/mirror`.
5. Chrome MCP at 1280x800 on `/@hpark0011`: confirm pencil + close-X side-by-side in chrome (pencil left, X right). Click pencil → EditActions Back+Save appear inside chrome row. Click Back → returns to pencil + X. Confirm no in-panel mount visible (it's `md:hidden`).
6. Chrome MCP at 390x844: confirm pencil renders inside ProfilePanel (in-panel md:hidden mount becomes visible, no chrome mount because mobile bypasses WorkspaceInteractionPanel). Click pencil → EditActions appear. Click Back → returns to pencil. Confirm no double-rendered button.

## Constraints

- Aria attributes on `EditProfileButton`, `EditActions`, and the close-X must be preserved verbatim — none of those components are restyled here
- The chrome row's left-to-right order must be edit-affordances first, close-X last (matches pre-FG_080 desktop visual)
- The in-panel mount in `profile-panel.tsx` must be hidden at `md+` — verify by inspecting computed styles in the verifier, not just by greppling for `md:hidden`
- No new context, no new files, no state-management library
- Do not touch the close-X's render gate (`chrome?.canCollapseInteractionPanel && !chrome.isInteractionPanelCollapsed`) — that came from FG_082 and is correct; only its container changes

## Resources

- FG_080 (completed) — created the desktop split-container coupling and the `right-14` offset this ticket eliminates
- FG_082 (completed) — `WorkspaceChromeContext` capability flags; the close-X render gate already uses `chrome?.canCollapseInteractionPanel`, no change needed here
- FG_085 (completed) — lifted edit-mode state into `ProfileRouteDataContext`; this ticket consumes that state from `WorkspaceInteractionPanel` for the first time
