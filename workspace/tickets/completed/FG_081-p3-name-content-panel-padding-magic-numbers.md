---
id: FG_081
title: "ContentPanel padding values are named, not magic"
date: 2026-04-27
type: refactor
status: completed
priority: p3
description: "ContentPanel uses arbitrary Tailwind values pb-[64px] and max-h-[40px] for the scroll-container footer reservation and the top fade-mask height. Both are silently load-bearing — changing the toolbar slot height or the chat input height will visually break the scroll padding without any compile-time signal. Replace with named constants or CSS custom properties so the dependency is explicit."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "grep -n 'pb-\\[64px\\]\\|max-h-\\[40px\\]' apps/mirror/app/\\[username\\]/_components/content-panel.tsx returns 0 matches"
  - "Each replaced value is sourced from a named constant or CSS custom property whose name describes the relationship (e.g. SCROLL_FOOTER_PAD_PX, --content-fade-mask-height)"
  - "pnpm build --filter=@feel-good/mirror succeeds"
  - "pnpm lint --filter=@feel-good/mirror succeeds"
  - "Visually verified: content list has the same bottom padding and the same top fade gradient before and after the change (Chrome MCP screenshot at 1280×800 and 390×844)"
owner_agent: "React refactoring specialist"
---

# ContentPanel padding values are named, not magic

## Context

`apps/mirror/app/[username]/_components/content-panel.tsx:58-62`:

```tsx
<div className="w-full absolute top-0 bg-linear-to-b to-transparent max-h-[40px] z-10 from-background" />
<div
  ref={setScrollRoot}
  className="overflow-y-auto h-full pb-[64px] pt-0"
>
```

`pb-[64px]` reserves footer space for a UI element that lives above the scroll container (likely the chat input or sticky footer). `max-h-[40px]` is the height of the top fade-mask gradient.

Neither value names what it pairs with. If the chat input's height changes, or the toolbar slot grows, the scroll padding silently de-syncs and content gets clipped or hidden behind UI. Tailwind v4 supports CSS custom properties cleanly via `pb-[var(--name)]`; a named constant in TypeScript also works for static cases.

## Goal

Both arbitrary values are replaced with named references that make the relationship explicit, so future changes to the dependent UI surfaces will be discoverable.

## Scope

- Replace `pb-[64px]` with a named reference (constant string, CSS custom property, or co-located config)
- Replace `max-h-[40px]` with a named reference for the top fade-mask height
- Add a one-line comment near each name explaining what it pairs with

## Out of Scope

- Restructuring the scroll container or the fade mask
- Changing the actual visual values (this ticket is preserve-and-name only)
- Refactoring other arbitrary values elsewhere in the codebase
- Introducing a new design-token system if one doesn't already exist

## Approach

Two viable shapes:

1. **CSS custom property** in `apps/mirror/styles/globals.css` (or a co-located stylesheet) with `--content-scroll-footer-pad: 64px;` and `--content-fade-mask-height: 40px;`, then `pb-[var(--content-scroll-footer-pad)]` etc.
2. **TypeScript constants** at the top of `content-panel.tsx` and used inline.

Pick whichever matches the existing convention in the file's neighborhood. Whatever the choice, the name should describe the *relationship* (footer pad / fade mask), not the value.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Decide between CSS custom property vs TS constant by inspecting how nearby components handle similar values (`grep -rn 'var(--' apps/mirror/app/\\[username\\]/_components` to see if there's a precedent).
2. Add the two names + values + a one-line comment each.
3. Replace both arbitrary Tailwind values in `content-panel.tsx`.
4. `pnpm build --filter=@feel-good/mirror` and `pnpm lint --filter=@feel-good/mirror`.
5. Chrome MCP: screenshot `/@user/posts` at 1280×800 and 390×844 before and after; diff visually.

## Constraints

- Do not change the visual values (`64px` and `40px`) — preserve current rendering
- Do not introduce a new design-token system
- No new external CSS imports

## Resources

- PR #13 — branch where this code is unchanged from earlier work but the smell is now visible
