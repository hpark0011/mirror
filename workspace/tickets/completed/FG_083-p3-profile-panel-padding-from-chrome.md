---
id: FG_083
title: "ProfilePanel padding sourced from chrome instead of viewport proxies"
date: 2026-04-27
type: refactor
status: completed
priority: p3
description: "profile-panel.tsx uses useIsMobile() to pick pt-24 vs py-[132px]. Those magic numbers encode the heights of OTHER components (navbar, bottom toolbar). If chrome dimensions change, ProfilePanel breaks silently with no compile error. Same class of bug FG_081 just fixed for content-panel.tsx — relationship-explicit naming. Source the values from chrome (CSS variables or named constants) so the dependency is discoverable."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "grep -n 'useIsMobile\\|isMobile' apps/mirror/app/\\[username\\]/_components/profile-panel.tsx returns 0 matches"
  - "grep -n 'pt-24\\|py-\\[132px\\]' apps/mirror/app/\\[username\\]/_components/profile-panel.tsx returns 0 matches"
  - "The vertical padding values consumed by ProfilePanel are sourced from chrome (CSS custom property set by desktop-workspace/mobile-workspace, OR named constant imported from a chrome module). The relationship between the value and the chrome surface it pairs with is documented in a comment near the source-of-truth definition."
  - "pnpm build --filter=@feel-good/mirror succeeds"
  - "pnpm lint --filter=@feel-good/mirror succeeds"
  - "Visual parity preserved at 1280×800 and 390×844 (Chrome MCP screenshots show same vertical positioning of profile content as before this change)"
owner_agent: "React refactoring specialist"
---

# ProfilePanel padding sourced from chrome instead of viewport proxies

## Context

`apps/mirror/app/[username]/_components/profile-panel.tsx:17,29-31` (after FG_080) has:

```tsx
const isMobile = useIsMobile();
// ...
<div
  className={isMobile
    ? "relative h-full pt-24"
    : "relative z-20 h-full flex flex-col justify-start items-center px-6 py-[132px]"}
>
```

`pt-24` (96px) reserves space for the mobile workspace navbar above. `py-[132px]` reserves space for the desktop navbar + bottom toolbar stack. Both are magic numbers that encode the heights of OTHER components — if the navbar grows by 8px or the toolbar height changes, ProfilePanel silently de-syncs and content gets clipped or floats wrong.

This is the second `useIsMobile` usage in profile-panel.tsx. FG_080 left it intact because it was out of scope (FG_080 only addressed the chrome-decision usage). This ticket finishes the cleanup using the same pattern FG_081 used for content-panel.tsx: name the values, source them from where the dependency actually lives, document what they pair with.

The cleanest source is chrome itself — `desktop-workspace.tsx` and `mobile-workspace.tsx` are the providers that know their own navbar/toolbar heights, so they should publish the resulting padding values for consumers.

## Goal

ProfilePanel reads its top/bottom padding values from chrome (CSS custom properties or named constants the chrome modules expose), not from `useIsMobile()`. The remaining `useIsMobile` import in profile-panel.tsx is gone — not because the className branch was rewritten, but because the architectural reason for it disappeared.

## Scope

- Define the padding source-of-truth on the chrome side (CSS custom properties on the chrome wrapper element, or named constants exported from a chrome module). Names must describe the relationship (e.g. `WORKSPACE_CONTENT_TOP_PAD_PX`, `WORKSPACE_CONTENT_BOTTOM_PAD_PX`, or `--workspace-content-top-pad`).
- Set the values in `desktop-workspace.tsx` (132/132) and `mobile-workspace.tsx` (96/0).
- Replace the `pt-24` / `py-[132px]` className branch in `profile-panel.tsx` with the chrome-sourced values (via `style` prop or `className` referencing the CSS custom property).
- Drop the `useIsMobile` import from `profile-panel.tsx` if it becomes unused.

## Out of Scope

- Refactoring other arbitrary Tailwind values in unrelated components
- Introducing a cross-app design-token system
- Changing the actual numeric padding values (this is preserve-and-relocate, not retune)
- Replacing other `useIsMobile` call sites in the codebase

## Approach

Two viable shapes (pick whichever matches existing precedent):

1. **CSS custom properties** set by chrome wrappers. `desktop-workspace.tsx` adds `style={{ '--workspace-content-top-pad': '132px', '--workspace-content-bottom-pad': '132px' }}` to its root container. `mobile-workspace.tsx` sets `--workspace-content-top-pad: 96px` and `--workspace-content-bottom-pad: 0`. ProfilePanel uses `pt-[var(--workspace-content-top-pad)] pb-[var(--workspace-content-bottom-pad)]`.

2. **TS constants** exported from a new module (e.g. `apps/mirror/app/[username]/_components/workspace-padding.ts`), with chrome-aware getters or just a small object mapping. ProfilePanel imports and applies via `style` prop.

FG_081 used file-local TS constants for content-panel. For values that span multiple components (chrome owner + chrome consumer), CSS custom properties on the chrome wrapper avoid prop-drilling and keep the relationship in one direction (chrome publishes, consumer reads). Recommended choice: **CSS custom properties**.

- **Effort:** Small
- **Risk:** Low — preserve-and-relocate, no behavior change

## Implementation Steps

1. Decide between CSS custom properties vs TS constants by inspecting existing precedent (`grep -rn 'var(--' apps/mirror/styles apps/mirror/app/[username]/_components` and `grep -rn 'export const [A-Z_]*_PX' apps/mirror`). FG_081 picked TS constants for file-local; for cross-component values, prefer CSS custom properties.
2. If CSS custom property: pick names like `--workspace-content-top-pad` and `--workspace-content-bottom-pad`. Add them to the root container `style` prop in `desktop-workspace.tsx` (132px each) and `mobile-workspace.tsx` (96px / 0).
3. Edit `profile-panel.tsx`: replace the `isMobile ? "...pt-24" : "...py-[132px]"` branch with className using `pt-[var(--workspace-content-top-pad)] pb-[var(--workspace-content-bottom-pad)]`. Keep the rest of the className intact (`relative h-full flex flex-col justify-start items-center px-6` etc., adapted from the desktop branch — verify mobile didn't need the flex/items chain).
4. Remove the `useIsMobile` import and `const isMobile = useIsMobile();` line from `profile-panel.tsx`.
5. `pnpm build --filter=@feel-good/mirror`.
6. `pnpm lint --filter=@feel-good/mirror`.
7. Chrome MCP at 1280×800: visit `/@hpark0011`, screenshot, compare vertical positioning to baseline. At 390×844: same comparison.

## Constraints

- Do not change the numeric padding values (preserve current rendering)
- Do not introduce a cross-app design-token system
- The naming of any new constant or custom property must describe the relationship (top pad / bottom pad), not the value
- The two layouts may have different non-padding classes (mobile is `relative h-full pt-24` only; desktop adds `flex flex-col justify-start items-center px-6 z-20`). Preserve the non-padding differences — this ticket relocates only the padding values

## Resources

- FG_080 (completed) — left this `useIsMobile` usage intact because it was out of scope at the time
- FG_081 (completed) — solved the same class of bug for content-panel.tsx; the pattern is "name the value, document what it pairs with"
- FG_082 — companion ticket addressing the chrome-decision flavor of `useIsMobile`-as-proxy
