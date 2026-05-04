---
id: FG_144
title: "Editor package public surface is curated to what consumers actually use"
date: 2026-05-05
type: refactor
status: to-do
priority: p2
description: "packages/features/editor/index.ts re-exports several slash-command and bubble-menu internals that no consumer outside the package imports."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "`grep -rn \"@feel-good/features/editor\" apps/ packages/` shows no consumer importing the symbols slated for removal (buildSlashCommandItems, filterSlashCommandItems, SlashCommand, SlashCommandItem, SlashCommandOptions, TextBubbleMenu, SlashCommandSuggestions, createArticleEditorExtensions)."
  - "`packages/features/editor/index.ts` no longer exports those symbols."
  - "`pnpm build --filter=@feel-good/mirror` passes."
owner_agent: "frontend engineer (TypeScript)"
---

# Editor package public surface is curated to what consumers actually use

## Context

Surfaced by the PR #34 code review (`code-review-pr34` batch). `packages/features/editor/index.ts:17-28` re-exports `buildSlashCommandItems`, `filterSlashCommandItems`, `SlashCommand`, `SlashCommandItem`, `SlashCommandOptions`, `TextBubbleMenu`, `SlashCommandSuggestions`, and `createArticleEditorExtensions`. A grep across all consumers of `@feel-good/features/editor` (article-editor-shell, content-editor, post-editor, the form hooks) imports only `ArticleRichTextEditor`, `EditorToolbar`, `JSONContent`, `InlineImageUploadResult`, `RichTextEditor`, and `createArticleExtensions`. None of the slash-command or bubble-menu internals are used externally.

**Risk:** every re-exported symbol is an implicit stability contract. Future external callers can reach for `SlashCommand` or `TextBubbleMenu` directly, bypassing the configured `ArticleRichTextEditor` wrapper. That creates a coordination burden every time those internals change.

## Goal

The package's `index.ts` exposes only what app-level callers consume; internal symbols stay package-private.

## Scope

- Remove unused re-exports from `packages/features/editor/index.ts`.
- Verify no consumer was relying on them via path-based imports.

## Out of Scope

- Refactoring the slash-command or bubble-menu internals.
- Renaming public symbols.

## Approach

Audit consumers, then prune the index.

- **Effort:** Small
- **Risk:** Low (deletion-only after grep confirms zero consumers)

## Implementation Steps

1. Run `grep -rn "@feel-good/features/editor" apps/ packages/` to enumerate consumers and the exact symbols imported.
2. For each symbol in `index.ts:17-28`, confirm zero external imports.
3. Remove the unused re-exports.
4. Run `pnpm build --filter=@feel-good/mirror` to confirm no regressions.

## Constraints

- Deletion-only change. Do not add new abstractions.
- If any consumer is found relying on a symbol, leave that one exported.

## Resources

- PR #34: https://github.com/hpark0011/mirror/pull/34
