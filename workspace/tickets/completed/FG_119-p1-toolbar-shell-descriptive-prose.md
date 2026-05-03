---
id: FG_119
title: "Toolbar shell renders only interactive affordances, no descriptive prose"
date: 2026-05-03
type: refactor
status: completed
priority: p1
description: "Bio and clone-settings panels were refactored to render their description copy inside ContentToolbarShell, breaking the established convention that the workspace toolbar contains only buttons, filters, and back links."
dependencies: []
acceptance_criteria:
  - "grep -n 'Work and education history\\|Customize how your AI clone speaks' apps/mirror/features/bio/components/bio-toolbar.tsx apps/mirror/features/clone-settings/components/clone-settings-toolbar.tsx returns zero matches (descriptive prose removed from toolbar files)"
  - "grep -n 'Work and education history' apps/mirror/features/bio/components/bio-panel.tsx returns at least one match (copy lives in panel body)"
  - "grep -n 'Customize how your AI clone speaks' apps/mirror/features/clone-settings/components/clone-settings-panel.tsx returns at least one match (copy lives in panel body)"
  - "pnpm build --filter=@feel-good/mirror exits 0"
  - "pnpm lint --filter=@feel-good/mirror exits 0"
owner_agent: "Frontend refactor engineer (React/Tailwind, feature-module conventions)"
---

# Toolbar shell renders only interactive affordances, no descriptive prose

## Context

Surfaced by `/review-code` on branch `refactor-workspace-toolbar`. The toolbar-unification refactor in commit `996ebc32` placed descriptive body copy inside `ContentToolbarShell`:

- `apps/mirror/features/bio/components/bio-toolbar.tsx:21` — `<div className="text-[13px]">Work and education history.</div>`
- `apps/mirror/features/clone-settings/components/clone-settings-toolbar.tsx:17-19` — `<h2 className="text-[13px] font-medium text-foreground">Customize how your AI clone speaks.</h2>`

Every existing caller of `ContentToolbarShell` renders only interactive affordances:

- `apps/mirror/features/articles/components/article-list-toolbar.tsx` — buttons + dropdowns
- `apps/mirror/features/posts/components/post-list-toolbar.tsx` — buttons + dropdowns
- `apps/mirror/features/articles/components/article-detail-toolbar.tsx` — `ContentBackLink` only
- `apps/mirror/features/posts/components/post-detail-toolbar.tsx` — `ContentBackLink` + `PublishToggleConnector` only

The original `bio-panel.tsx` and `clone-settings-panel.tsx` rendered the description as a `<p className="text-sm text-muted-foreground">` in the panel body. Moving it into the toolbar conflates two distinct surfaces (chrome vs content), making the shell's contract ambiguous for future panels.

## Goal

`ContentToolbarShell` callers contain only interactive elements; descriptive prose lives in the panel body where it semantically belongs.

## Scope

- Remove descriptive prose from `bio-toolbar.tsx` and re-render it in the bio panel body
- Remove descriptive prose from `clone-settings-toolbar.tsx` and re-render it in the clone-settings panel body
- Confirm both panels still pass build + lint after the move

## Out of Scope

- Restoring the original `<h2>Bio</h2>` and `<h2>Clone settings</h2>` page headings — that's the related semantic concern tracked in FG_120
- Refactoring how `ContentToolbarShell` itself renders — the variant prop is fine as-is
- Article-list and post-list toolbars — already conform to the convention

## Approach

Two independent edits, one per panel.

For `bio-panel.tsx`: add a `<p className="text-sm text-muted-foreground">Work and education history.</p>` at the top of the inner panel `<div>` before `<BioEntryList>`. Remove the descriptive `<div>` from `bio-toolbar.tsx`. The toolbar then contains only the conditional `BioAddEntryButton`.

For `clone-settings-panel.tsx`: add a `<p className="text-sm text-muted-foreground mb-4">Customize how your AI clone speaks.</p>` above the `<Form>` element. Remove the heading from `clone-settings-toolbar.tsx`. The toolbar then contains only the Save button.

Verify the visual result via Chrome MCP screenshot of `/@<owner>/bio` and `/@<owner>/clone-settings`.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Edit `apps/mirror/features/bio/components/bio-toolbar.tsx` to remove the `<div className="text-[13px]">` child of `ContentToolbarShell`
2. Edit `apps/mirror/features/bio/components/bio-panel.tsx` to render `<p className="text-sm text-muted-foreground">Work and education history.</p>` inside the inner panel `<div>` above `<BioEntryList>`
3. Edit `apps/mirror/features/clone-settings/components/clone-settings-toolbar.tsx` to remove the `<h2>` child of `ContentToolbarShell`
4. Edit `apps/mirror/features/clone-settings/components/clone-settings-panel.tsx` to render `<p className="text-sm text-muted-foreground mb-4">Customize how your AI clone speaks.</p>` above the `<Form>` element
5. Run `pnpm build --filter=@feel-good/mirror` and `pnpm lint --filter=@feel-good/mirror` — both must pass
6. Chrome MCP screenshot both pages to confirm the description still appears in the panel body, not the toolbar

## Constraints

- Do not change `ContentToolbarShell` itself
- Do not reintroduce a page-level `<h2>` heading — that decision belongs to FG_120
- Keep existing `data-testid` attributes intact

## Resources

- Originating review: branch `refactor-workspace-toolbar` `/review-code` output
- Convention rule: `.claude/rules/file-organization.md`, established by existing toolbar callers
