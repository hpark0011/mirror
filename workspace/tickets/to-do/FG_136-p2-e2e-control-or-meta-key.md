---
id: FG_136
title: "E2E select-all uses ControlOrMeta+A for cross-platform CI"
date: 2026-05-05
type: fix
status: to-do
priority: p2
description: "Two e2e tests press Meta+A which only works on macOS; Linux and Windows CI runners need ControlOrMeta+A to map to Ctrl."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "`grep -n \"Meta+A\" apps/mirror/e2e/article-editor.authenticated.spec.ts` returns no matches."
  - "`grep -n \"ControlOrMeta+A\" apps/mirror/e2e/article-editor.authenticated.spec.ts` returns matches at the previous Meta+A locations (originally lines 158 and 201)."
  - "`pnpm --filter=@feel-good/mirror test:e2e -- article-editor` passes locally."
owner_agent: "test engineer (Playwright)"
---

# E2E select-all uses ControlOrMeta+A for cross-platform CI

## Context

Surfaced by the PR #34 code review (`code-review-pr34` batch); also raised by CodeRabbit (PR thread r3180086644). `apps/mirror/e2e/article-editor.authenticated.spec.ts:158` and `:201` use `page.keyboard.press('Meta+A')` to select all text before testing the bubble-menu and fixed-toolbar formatting paths. Playwright's `playwright.config.ts` targets only `Desktop Chrome` with no platform variant. On Linux CI Chromium, Meta is the Windows key and has no select-all binding — the selection is empty, the bubble menu doesn't appear, and the assertion times out.

**Risk:** these two tests pass locally on macOS but fail on every Linux CI run, making them unreliable gating signals.

## Goal

Both select-all keystrokes work on macOS, Linux, and Windows CI without conditional logic.

## Scope

- Replace both `Meta+A` occurrences with `ControlOrMeta+A`.

## Out of Scope

- Other keyboard shortcuts in the spec.
- Adding cross-platform Playwright projects.

## Approach

`ControlOrMeta` is Playwright's documented cross-platform modifier — resolves to Meta on macOS and Control elsewhere.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. In `apps/mirror/e2e/article-editor.authenticated.spec.ts`, replace `page.keyboard.press('Meta+A')` at line 158 with `page.keyboard.press('ControlOrMeta+A')`.
2. Repeat at line 201.
3. Run `pnpm --filter=@feel-good/mirror test:e2e -- article-editor` and confirm both tests pass.

## Constraints

- Do not change other keyboard interactions in the spec.

## Resources

- PR #34: https://github.com/hpark0011/mirror/pull/34
- CodeRabbit thread: https://github.com/hpark0011/mirror/pull/34#discussion_r3180086644
- Playwright docs: https://playwright.dev/docs/api/class-keyboard
