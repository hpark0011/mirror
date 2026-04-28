---
id: FG_085
title: "Profile edit-mode state lives in ProfileRouteDataContext"
date: 2026-04-27
type: refactor
status: completed
priority: p3
description: "FG_084 wants to relocate EditProfileButton/EditActions from ProfilePanel into WorkspaceInteractionPanel chrome, but the buttons read isEditing/isSubmitting from ProfilePanel's local useState — chrome can't see that state without it being lifted. Lift the edit-mode state (isEditing, setIsEditing, isSubmitting, setIsSubmitting) into ProfileRouteDataContext so both ProfilePanel and any chrome consumer can read and write it. Pure preparatory refactor — no JSX moves, no behavior change."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "grep -n 'isEditing\\|isSubmitting\\|setIsEditing\\|setIsSubmitting' apps/mirror/app/\\[username\\]/_providers/profile-route-data-context.tsx returns at least 4 matches (the four fields declared on the ProfileRouteData type)"
  - "grep -n 'useState' apps/mirror/app/\\[username\\]/_components/profile-panel.tsx returns 0 matches (ProfilePanel no longer owns local edit-mode state)"
  - "grep -n 'useProfileRouteData' apps/mirror/app/\\[username\\]/_components/profile-panel.tsx returns at least 1 match destructuring isEditing and isSubmitting (or their setters) alongside the existing profile/isOwner/setVideoCallOpen reads"
  - "ProfileInfo's isEditing prop and onEditComplete/onSubmittingChange callbacks in profile-panel.tsx are wired to the lifted context — the existing handleEditClose useCallback either still exists (calling the lifted setters) or is replaced by direct setter references"
  - "pnpm build --filter=@feel-good/mirror succeeds"
  - "pnpm lint --filter=@feel-good/mirror succeeds"
  - "Edit-mode round trip works at 1280x800 and 390x844: clicking pencil enters edit mode, EditActions Back button exits edit mode, no flicker (manually verified via Chrome MCP)"
owner_agent: "React refactoring specialist"
---

# Profile edit-mode state lives in ProfileRouteDataContext

## Context

FG_084 (in `workspace/tickets/to-do/`) wants `EditProfileButton`/`EditActions` to render inside `WorkspaceInteractionPanel` chrome (in `apps/mirror/app/[username]/_components/workspace-panels.tsx`) alongside the close-X, instead of inside `ProfilePanel` (`apps/mirror/app/[username]/_components/profile-panel.tsx`). When the resolving-tickets executor began that work, it stopped at the precondition check: today, `ProfilePanel` owns the edit-mode state as local `useState`:

```tsx
// apps/mirror/app/[username]/_components/profile-panel.tsx:17-23
const [isEditing, setIsEditing] = useState(false);
const [isSubmitting, setIsSubmitting] = useState(false);

const handleEditClose = useCallback(() => {
  setIsEditing(false);
  setIsSubmitting(false);
}, []);
```

Chrome can't reach that state. Lifting it is a precondition for FG_084's structural reorganization, and it's worth landing on its own because (a) it's a small, mechanical, low-risk change with no visual effect, and (b) decoupling owner-edit state from a single panel's local memory is a good shape regardless of whether FG_084 ever lands.

`ProfileRouteDataContext` (`apps/mirror/app/[username]/_providers/profile-route-data-context.tsx`) is the natural home: it already carries owner-aware profile state (`profile`, `isOwner`, `videoCallOpen`/`setVideoCallOpen`) and its provider wraps the entire `[username]` route at `apps/mirror/app/[username]/layout.tsx:86-94`, so every panel rendered under it (ProfilePanel, WorkspaceInteractionPanel, future chrome consumers) is automatically a descendant.

Note: FG_084's acceptance_criteria #1 (`grep EditProfileButton profile-panel.tsx returns 0 matches`) cannot be satisfied while preserving the mobile edit affordance — `MobileWorkspace` does not render `WorkspaceInteractionPanel`, and the bare-profile mobile route has no other chrome surface to mount the button on. That is FG_084's problem to solve when it's revisited (relax the criterion to permit a `md:hidden` mobile mount, or expand FG_084's scope to add a mobile chrome surface). This ticket does not pre-empt that decision — it only lifts the state so FG_084 has the affordance available regardless of which path it picks.

## Goal

`ProfileRouteData` exposes `isEditing`, `setIsEditing`, `isSubmitting`, and `setIsSubmitting`. `ProfilePanel` reads all four from the context and stops owning local edit-mode `useState`. End-user behavior (pencil enters edit mode, EditActions Back exits) is bit-for-bit identical at all viewports.

## Scope

- Add `isEditing: boolean`, `setIsEditing: (v: boolean) => void`, `isSubmitting: boolean`, `setIsSubmitting: (v: boolean) => void` to the `ProfileRouteData` type in `apps/mirror/app/[username]/_providers/profile-route-data-context.tsx`.
- Initialize the two state pairs with `useState(false)` inside `ProfileRouteDataProvider`. Include the new fields in the `useMemo` value alongside the existing `videoCallOpen`/`setVideoCallOpen`.
- In `apps/mirror/app/[username]/_components/profile-panel.tsx`: replace `useState(false)` for `isEditing` and `isSubmitting` with reads from `useProfileRouteData()`. Keep `handleEditClose` (it now calls the lifted setters) or inline it — pick whichever keeps the file shorter without adding noise. Drop the `useState` import if it becomes unused.
- Verify `ProfileInfo`'s existing `isEditing` / `onEditComplete` / `onSubmittingChange` props receive the lifted state and setters. Behavior contract unchanged.

## Out of Scope

- Moving `EditProfileButton`/`EditActions` JSX out of `ProfilePanel` (FG_084's territory)
- Removing the `right-14` offset or its dependency comment (FG_084's territory)
- Changing the edit-mode UX
- Introducing a state-management library
- Adding a mobile-only chrome surface, navbar mount, or any new UI
- Splitting `ProfileRouteDataContext` into a separate `ProfileEditModeContext` — the existing context is small and the four new fields are owner-edit-adjacent, which fits its current scope
- Updating FG_084's acceptance_criteria — that is FG_084's problem to revisit when it's re-picked-up

## Approach

`ProfileRouteDataContext` already follows the pattern this ticket needs: `videoCallOpen` is a boolean pair of state + setter, initialized in the provider with `useState`, included in the `useMemo` value, and consumed via `useProfileRouteData()`. Add `isEditing` and `isSubmitting` the same way. The `useMemo` dependency array grows by four (the two booleans + the two setters; setters are stable refs from `useState` but listing them keeps the pattern symmetric with `setVideoCallOpen`).

In `ProfilePanel`, the substitution is direct: drop the local `useState` lines, destructure the four fields from `useProfileRouteData()`, and re-use the existing `handleEditClose` closure (it calls the same setter signatures) or inline `() => { setIsEditing(false); setIsSubmitting(false); }` at the `onEditComplete`/`onCancel` call sites. Either is fine; keep whichever is shorter.

- **Effort:** Small
- **Risk:** Low — pure state lift with no visual effect; the failure mode is a flicker on mount or a stale closure, both of which manifest immediately at first interaction.

## Implementation Steps

1. Edit `apps/mirror/app/[username]/_providers/profile-route-data-context.tsx`:
   - Extend the `ProfileRouteData` type with `isEditing`, `setIsEditing`, `isSubmitting`, `setIsSubmitting`.
   - Inside `ProfileRouteDataProvider`, add `const [isEditing, setIsEditing] = useState(false);` and `const [isSubmitting, setIsSubmitting] = useState(false);` next to the existing `videoCallOpen` state.
   - Include all four fields in the `useMemo` `routeDataValue` object and its dependency array. Keep `useMemo` reference identity stable when none of the value fields change.
2. Edit `apps/mirror/app/[username]/_components/profile-panel.tsx`:
   - Destructure `isEditing`, `setIsEditing`, `isSubmitting`, `setIsSubmitting` from `useProfileRouteData()` alongside `profile`, `isOwner`, `setVideoCallOpen`.
   - Delete the two `useState(false)` lines.
   - Re-point `handleEditClose` (or its inlined replacement) at the lifted setters. ProfileInfo's `onSubmittingChange={setIsSubmitting}` should pass the lifted setter directly (its signature is identical).
   - Drop `useState` from the React import line if no other call site in the file uses it.
3. Run `pnpm build --filter=@feel-good/mirror`.
4. Run `pnpm lint --filter=@feel-good/mirror`.
5. Chrome MCP at 1280x800 on `/@hpark0011`: click the pencil → confirm `EditActions` appears, the bio/name fields become editable. Click Back → confirm exit. Repeat at 390x844.

## Constraints

- No visual regression at any viewport. The pencil button still renders inside `ProfilePanel` (FG_084 is the one that moves it).
- Setter identity must come from `useState` directly — do not wrap with `useCallback` (it's redundant, since `useState` setters are already stable, and adding `useCallback` here would diverge from the existing `setVideoCallOpen` shape in the same context).
- No new files, no new contexts, no new hooks.
- The `ProfileRouteData` non-null invariant (the throw inside `useProfileRouteData`) must remain — every consumer of the new fields must already be inside the provider, which they are via the layout-level provider mount.
- Preserve `ProfileInfo`'s prop names (`isEditing`, `onEditComplete`, `onSubmittingChange`) exactly — `ProfileInfo` is in `apps/mirror/features/profile` and out of scope for renaming.

## Manual Verification

The deterministic acceptance_criteria cover the structural change (greps + build + lint). The end-to-end edit-mode round trip at both viewports is the manual check, run via Chrome MCP per `.claude/rules/verification.md` Tier 4.

## Resources

- FG_084 (in `workspace/tickets/to-do/`) — the downstream ticket that needs this state lifted before it can move EditProfileButton/EditActions into chrome. After this ticket lands, FG_084 still requires its acceptance_criteria #1 to be revised (mobile must retain a `md:hidden` mount in ProfilePanel because the mobile bare-profile route has no chrome surface).
- FG_080 (completed) — moved the close-X button into chrome; introduced the `right-14` offset coupling FG_084 will eliminate.
- `apps/mirror/app/[username]/_providers/profile-route-data-context.tsx:22-66` — the precedent shape (`videoCallOpen`/`setVideoCallOpen`) to follow.
- `.claude/rules/state-management.md` — three-tier hierarchy; this is a `useState` → React Context promotion (tier 1 → tier 3), justified because the state now needs to cross sibling subtrees (ProfilePanel + WorkspaceInteractionPanel under DesktopWorkspace).
