---
id: FG_140
title: "Editor and articles modules use inline type imports"
date: 2026-05-05
type: refactor
status: to-do
priority: p2
description: "Sixteen-plus newly added files use standalone `import type {}` lines, violating the project rule requiring inline type imports."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "`grep -rn '^import type {' packages/features/editor/ apps/mirror/features/articles/` returns no matches except for files where no value import exists from that same module."
  - "Each previously-standalone `import type` is collapsed into an inline specifier on a value import from the same module (e.g. `import { useState, type KeyboardEvent } from 'react'`)."
  - "`pnpm build --filter=@feel-good/mirror` and `pnpm lint --filter=@feel-good/mirror` pass."
owner_agent: "frontend engineer (TypeScript)"
---

# Editor and articles modules use inline type imports

## Context

Surfaced by the PR #34 code review (`code-review-pr34` batch). `.claude/rules/typescript.md` requires inline type imports: `import { useState, type KeyboardEvent } from "react"`. The rule is systemically violated across the new editor package and the articles feature in this branch:

- `packages/features/editor/components/toolbar/format-actions.ts:13-14`
- `packages/features/editor/components/toolbar/toolbar-button.tsx:9`
- `packages/features/editor/components/slash-command-suggestions.tsx:15,17`
- `packages/features/editor/components/bubble-menu/text-bubble-menu.tsx:13`
- `apps/mirror/features/articles/hooks/use-new-article-form.tsx:10,30`
- `apps/mirror/features/articles/components/article-editor-shell.tsx:16,19`
- (16+ files total)

**Risk:** sets a divergent pattern for the new editor package; future contributors copy the standalone form, and the codebase fragments.

## Goal

Every `import type {}` statement in the new files is collapsed into an inline specifier where a value import from the same module exists.

## Scope

- Audit all new files in `packages/features/editor/` and `apps/mirror/features/articles/` for standalone `import type` lines.
- Collapse each into the corresponding value-import statement.
- Where no value import from the same module exists, the standalone form is acceptable per TypeScript semantics; flag those exceptions in a comment.

## Out of Scope

- Changing import order or adding any value imports.
- Refactoring imports outside the new files.

## Approach

Mechanical sweep. An ESLint rule (`@typescript-eslint/consistent-type-imports` with `{ prefer: "inline-type-imports" }`) would prevent regression — file as a follow-up if not already enabled.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Run `grep -rn '^import type {' packages/features/editor/ apps/mirror/features/articles/` to enumerate violations.
2. For each, check if the same module is already imported for value(s); if yes, collapse: `import { x, type Y } from "mod"`.
3. Re-run the grep; remaining matches must have no corresponding value import from that module.
4. `pnpm build --filter=@feel-good/mirror && pnpm lint --filter=@feel-good/mirror`.

## Constraints

- Do not introduce new value imports just to collapse a type import.

## Resources

- PR #34: https://github.com/hpark0011/mirror/pull/34
- `.claude/rules/typescript.md`
