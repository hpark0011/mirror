---
id: FG_225
title: "Remove the contentKindValidator alias in toolQueries"
date: 2026-05-14
type: refactor
status: completed
priority: p3
description: "`const contentKindValidator = navigableContentKindValidator;` in `chat/toolQueries.ts:85` is a no-op alias used 7 times in the same file. It adds a hop for future readers and offers no signal about why two names exist for the same validator."
dependencies: []
parent_plan_id: workspace/plans/2026-05-14-config-agent-content-authoring-plan.md
acceptance_criteria:
  - "`grep -n 'contentKindValidator' packages/convex/convex/chat/toolQueries.ts` returns 0 matches."
  - "Every prior call site uses `navigableContentKindValidator` directly."
  - "`pnpm --filter=@feel-good/convex test` exits 0."
  - "`pnpm --filter=@feel-good/convex check-types` exits 0."
owner_agent: "Convex chat tools refactorer"
---

# Remove the contentKindValidator alias in toolQueries

## Context

Code review on branch `hpark0011/explain-profile-config-agent` (P3, maintainability lane). The alias is pure noise: same shape, same name space, no semantic distinction. Every use can be replaced with the imported `navigableContentKindValidator` directly.

## Goal

`toolQueries.ts` uses one consistent name for the navigable content kind validator.

## Scope

- Delete the alias declaration at line 85.
- Replace each `contentKindValidator` reference with `navigableContentKindValidator`.

## Out of Scope

- Renaming `navigableContentKindValidator` itself.
- Touching the corresponding type alias (it's a different concern; not flagged).

## Approach

Two-line edit: remove alias, find-and-replace in the same file.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Edit `packages/convex/convex/chat/toolQueries.ts:85`: delete the alias.
2. Find-and-replace `contentKindValidator` → `navigableContentKindValidator` in the same file (7 expected occurrences).
3. Run `pnpm --filter=@feel-good/convex check-types` and `pnpm --filter=@feel-good/convex test`.

## Constraints

- Single-file change.
- Do not introduce any other naming refactor.

## Resources

- Current alias: `packages/convex/convex/chat/toolQueries.ts:85`.
