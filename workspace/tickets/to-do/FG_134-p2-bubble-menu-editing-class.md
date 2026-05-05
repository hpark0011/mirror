---
id: FG_134
title: "Bubble menu applies the tiptap-bubble-menu--editing class during link edit mode"
date: 2026-05-05
type: fix
status: to-do
priority: p2
description: "The CSS variant for the link-editing bubble-menu state is defined but never applied because the className doesn't include isEditingLink in the cn() call."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "`apps/mirror/features/editor/components/bubble-menu/text-bubble-menu.tsx:124` (or new line number) uses `cn('tiptap-bubble-menu', isEditingLink && 'tiptap-bubble-menu--editing')`."
  - "A unit or e2e test asserts the bubble-menu element gains the `tiptap-bubble-menu--editing` class when the link editor is opened."
  - "`pnpm build --filter=@feel-good/mirror` and `pnpm lint --filter=@feel-good/mirror` pass."
owner_agent: "frontend engineer (React/Tiptap)"
---

# Bubble menu applies the tiptap-bubble-menu--editing class during link edit mode

## Context

Surfaced by the PR #34 code review (`code-review-pr34` batch); also raised by CodeRabbit (PR thread r3180086740). `packages/features/editor/components/bubble-menu/text-bubble-menu.tsx:124` renders `<div className={cn('tiptap-bubble-menu')}>` unconditionally. The CSS file `packages/features/editor/styles/article-editor.css:171` defines `.tiptap-bubble-menu--editing` styles (width, layout for the link input), but the class is never applied.

**Risk:** the link-edit variant styles are silently dead; layout/width constraints intended for the link editor never activate, leading to visual inconsistencies the user sees but the developer can't debug from the JSX alone.

## Goal

The bubble-menu element gains `tiptap-bubble-menu--editing` while `isEditingLink` is true; the CSS variant activates.

## Scope

- Wire `isEditingLink` into the `cn(...)` call.
- Add a regression test (unit or e2e).

## Out of Scope

- Changing the CSS variant rules.
- Refactoring the bubble menu component.

## Approach

One-line change to the className; one new test assertion.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Edit `packages/features/editor/components/bubble-menu/text-bubble-menu.tsx:124`: change `className={cn('tiptap-bubble-menu')}` to `className={cn('tiptap-bubble-menu', isEditingLink && 'tiptap-bubble-menu--editing')}`.
2. Add a unit-test or e2e assertion: open the link editor in the bubble menu, expect the element with `data-testid="text-bubble-menu"` (or equivalent) to have the `tiptap-bubble-menu--editing` class.
3. Run `pnpm --filter=@feel-good/mirror test:unit` (or test:e2e) to confirm the assertion passes.

## Constraints

- Do not change the CSS file.
- Do not break the default (non-editing) rendering.

## Resources

- PR #34: https://github.com/hpark0011/mirror/pull/34
- CodeRabbit thread: https://github.com/hpark0011/mirror/pull/34#discussion_r3180086740
