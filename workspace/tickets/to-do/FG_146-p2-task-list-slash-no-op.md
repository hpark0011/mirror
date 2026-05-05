---
id: FG_146
title: "Task List slash-command item is removed (or task-list extension is wired)"
date: 2026-05-05
type: fix
status: to-do
priority: p2
description: "The Task List slash-menu item always falls into a no-op branch because the task-list Tiptap extension is never loaded; users see the slash deleted with nothing inserted."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "Either: (a) the Task List item is removed from `buildSlashCommandItems` in `packages/features/editor/extensions/slash-command.ts`; OR (b) `@tiptap/extension-task-list` and `@tiptap/extension-task-item` are added to `packages/features/editor/lib/article-editor-extensions.ts`."
  - "Manual test: typing `/Task` either does NOT show a Task List option (option a), or shows it AND inserting it produces a task list (option b)."
  - "`pnpm --filter=@feel-good/mirror test:unit -- slash-command-items` passes."
owner_agent: "frontend engineer (Tiptap)"
---

# Task List slash-command item is removed (or task-list extension is wired)

## Context

Surfaced by the PR #34 code review (`code-review-pr34` batch). `packages/features/editor/extensions/slash-command.ts:125-151` includes a "Task List" slash-menu item whose command body checks `editor.commands.toggleTaskList` at runtime and falls back to a bare `deleteRange` no-op when the extension isn't loaded. The extension stack assembled by `createArticleEditorExtensions` (`packages/features/editor/lib/article-editor-extensions.ts:34-48`) does NOT include any task-list extension — `StarterKit` doesn't ship task-list, and nothing else in the array adds it. The runtime check always fails, the `else` branch fires, and selecting Task List silently deletes the `/` character.

**Risk:** confusing UX (user clicks Task List, nothing visible happens). The dead branch hides the misconfiguration from future devs — they must remember to wire BOTH the extension AND remove the defensive branch.

## Goal

Either Task List works end-to-end, or it isn't presented in the menu.

## Scope

- Decide between removing the menu item OR wiring `@tiptap/extension-task-list` + `@tiptap/extension-task-item`.
- Implement the decision.
- Update the slash-command-items unit test accordingly.

## Out of Scope

- Adding other unimplemented slash-menu items.
- Wider extension-stack refactoring.

## Approach

Default recommendation: **option (a) remove the Task List item** until task lists are an explicit product requirement. Less code, less risk, easy to add back when needed. Option (b) is straightforward but introduces a runtime extension and a CSS variant for task lists.

- **Effort:** Small (option a) / Medium (option b)
- **Risk:** Low

## Implementation Steps

1. Decide option a vs b based on whether task lists are a near-term product need (cite the spec or product owner).
2. **Option a**: remove the Task List item block from `buildSlashCommandItems` (lines 125-151) and update the unit test in `packages/features/editor/__tests__/slash-command-items.test.ts` to no longer expect that item.
3. **Option b**: install `@tiptap/extension-task-list` and `@tiptap/extension-task-item`, add both to `createArticleEditorExtensions`, add CSS for task-list rendering in `article-editor.css`, and remove the defensive runtime check.
4. Run the unit test and manually verify in dev.

## Constraints

- Pick one option; do not leave the dead branch in place.

## Resources

- PR #34: https://github.com/hpark0011/mirror/pull/34
- Tiptap task-list docs: https://tiptap.dev/docs/editor/extensions/nodes/task-list
