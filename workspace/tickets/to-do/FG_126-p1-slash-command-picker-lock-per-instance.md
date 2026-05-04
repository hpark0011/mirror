---
id: FG_126
title: "Slash-command image picker lock is scoped per editor instance"
date: 2026-05-05
type: fix
status: to-do
priority: p1
description: "A module-global `isPickerOpen` boolean in the slash-command extension is shared across every editor instance and the entire tab session, creating an unrecoverable failure mode for image insertion."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "`grep -n '^let isPickerOpen' packages/features/editor/extensions/slash-command.ts` returns no matches (the module-level declaration is gone)."
  - "Two simultaneously mounted `ArticleRichTextEditor` components can each open their own image picker without one blocking the other (verified via dev-mock or e2e)."
  - "`pnpm build --filter=@feel-good/mirror` passes after the change."
owner_agent: "frontend engineer (Tiptap)"
---

# Slash-command image picker lock is scoped per editor instance

## Context

Surfaced by the PR #34 code review (`code-review-pr34` batch); also raised by CodeRabbit (PR thread r3180086767). `packages/features/editor/extensions/slash-command.ts:49` declares `let isPickerOpen = false` at module scope. The IIFE at lines 188-205 toggles it `true` before opening the file picker and resets it in `finally`. Because the variable lives at module scope, all `SlashCommand` extension instances in the same JS module bundle share a single lock — multiple editors mounted on one page (split-pane, modal, future multi-pane layouts) silently block each other; a single stuck picker permanently disables image insertion across every editor in the tab until reload.

**Risk:** unrecoverable failure mode. Any edge case (browser dismissing the file picker without resolving, an exception escaping before the `try`, a future refactor that restructures the IIFE) corrupts the lock for the entire tab session.

## Goal

Each editor instance owns its own picker-open state; one editor's in-flight picker cannot block another's image command.

## Scope

- Move the picker lock into per-instance scope (Tiptap extension `addStorage()` or the extension instance closure).
- Confirm the lock still prevents re-entrant picker opens within a single editor.

## Out of Scope

- Replacing the file-picker UX itself.
- Changes to `pickInlineImage` consumers.

## Approach

Tiptap extensions support per-instance state via `addStorage()`. Move `isPickerOpen` into the SlashCommand extension's storage, and read/write it from within the slash-command item handler via the editor's storage namespace.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. In `packages/features/editor/extensions/slash-command.ts`, remove the module-level `let isPickerOpen = false` at line 49.
2. Inside the `SlashCommand` Tiptap extension definition, add `addStorage() { return { isPickerOpen: false }; }`.
3. In `buildSlashCommandItems` for the Image item, replace `if (isPickerOpen) return;` with `if (editor.storage.slashCommand.isPickerOpen) return;` and the assignments `isPickerOpen = true/false` with `editor.storage.slashCommand.isPickerOpen = true/false`.
4. Verify the slash command's `name` (used in `editor.storage.<name>`) matches the storage key.
5. Run `pnpm --filter=@feel-good/mirror test:unit -- slash-command-items` to ensure the existing menu-shape test still passes.

## Constraints

- Must preserve the re-entrant guard within a single editor (clicking Image twice rapidly should still open only one picker).
- Storage key must match the extension's name to avoid undefined access.

## Resources

- PR #34: https://github.com/hpark0011/mirror/pull/34
- CodeRabbit thread: https://github.com/hpark0011/mirror/pull/34#discussion_r3180086767
- Tiptap addStorage docs: https://tiptap.dev/docs/editor/api/extensions
