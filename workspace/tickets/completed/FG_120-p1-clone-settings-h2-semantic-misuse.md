---
id: FG_120
title: "Clone-settings panel <h2> wrongly used as 13px toolbar caption"
date: 2026-05-03
type: fix
status: completed
priority: p1
description: "The refactored clone-settings toolbar wraps a description string in an h2 element styled at 13px and font-medium, demoting a section heading to caption-size while detaching it from the panel's document outline."
dependencies:
  - FG_119
acceptance_criteria:
  - "grep -n '<h2' apps/mirror/features/clone-settings/components/clone-settings-toolbar.tsx returns zero matches"
  - "grep -n '<h2' apps/mirror/features/clone-settings/components/clone-settings-panel.tsx returns at least one match (page heading restored in panel body)"
  - "grep -n 'text-lg font-semibold' apps/mirror/features/clone-settings/components/clone-settings-panel.tsx returns at least one match on the same h2 line (size restored to original)"
  - "pnpm build --filter=@feel-good/mirror exits 0"
  - "pnpm lint --filter=@feel-good/mirror exits 0"
owner_agent: "Frontend a11y-aware engineer (semantic HTML, document outline)"
---

# Clone-settings panel <h2> wrongly used as 13px toolbar caption

## Context

Surfaced by `/review-code` on branch `refactor-workspace-toolbar` (commit `996ebc32`).

`apps/mirror/features/clone-settings/components/clone-settings-toolbar.tsx:17-19` currently renders:

```tsx
<h2 className="text-[13px] font-medium text-foreground">
  Customize how your AI clone speaks.
</h2>
```

Pre-refactor, the same panel had a proper section heading: `<h2 className="text-lg font-semibold mb-1">Clone settings</h2>` followed by a `<p>` description. The refactor moved the description into a portaled toolbar AND demoted it to an `<h2>` styled as 13px caption text. Two issues compound:

1. The element is semantically a heading but visually a label — assistive technology will announce it as a section heading, contradicting the visual hierarchy.
2. The `<h2>` lives inside `WorkspaceToolbar` (a `createPortal` target), so the page's document outline now has its only heading inside chrome, detached from the panel content it describes.

## Goal

The clone-settings panel has a correct document outline: at most one section heading (`<h2 className="text-lg font-semibold">Clone settings</h2>`) inside the panel body, no heading element inside the toolbar.

## Scope

- Remove the `<h2>` element from `clone-settings-toolbar.tsx`
- Restore the panel-body section heading `<h2>Clone settings</h2>` in `clone-settings-panel.tsx`
- Verify the document outline via accessibility tree (Chrome DevTools or axe scan)

## Out of Scope

- Bio panel heading restoration — no `<h2>` was misused there, only a `<div>` was used; covered by FG_119
- Toolbar shell visual layout changes
- Wider audit of other panels' heading usage

## Approach

Once FG_119 lands, the toolbar contains only the Save button — no copy at all. Then add `<h2 className="text-lg font-semibold mb-1">Clone settings</h2>` as the first child of the panel body in `clone-settings-panel.tsx`.

This ticket depends on FG_119 because the cleanest sequence is: remove prose from toolbar (FG_119), then add panel-body heading (FG_120).

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Confirm FG_119 has landed — toolbar should no longer contain descriptive copy
2. Edit `apps/mirror/features/clone-settings/components/clone-settings-panel.tsx` to add `<h2 className="text-lg font-semibold mb-1">Clone settings</h2>` at the top of the panel body, above the description `<p>` from FG_119
3. If FG_119 has not landed and this ticket is processed first: also remove the `<h2>` from `clone-settings-toolbar.tsx` so no stray heading remains in the toolbar
4. Run `pnpm build --filter=@feel-good/mirror` and `pnpm lint --filter=@feel-good/mirror`
5. Chrome MCP screenshot `/@<owner>/clone-settings` and confirm the heading is visually prominent (text-lg) and inside the panel content area

## Constraints

- Do not introduce more than one `<h2>` per page
- Heading text should be the page-level label "Clone settings", not the description copy
- Preserve existing `data-testid="clone-settings-panel"`

## Resources

- FG_119 — parent ticket that moves prose out of the toolbar
- Originating review: `/review-code` output on branch `refactor-workspace-toolbar`
