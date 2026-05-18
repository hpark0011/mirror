---
id: FG_254
title: "List post-delete hook guards are covered by unit tests"
date: 2026-05-18
type: chore
status: to-do
priority: p2
description: "The list delete hook's double-submit, null-target, escape-during-pending guards and error-keeps-dialog-open catch arm have zero unit tests and can be inverted or removed without any existing test failing."
dependencies: ["FG_252"]
acceptance_criteria:
  - "A Vitest spec covers the late-bound / no-router delete path (the list mode of the unified hook)"
  - "Tests assert: a second confirm while pending is a no-op; confirm with no target post returns early; close-while-pending is blocked; the catch arm shows an error toast and leaves the dialog open"
  - "`pnpm --filter=@feel-good/mirror run test:unit` passes"
  - "Inverting any one guard in the hook makes at least one of the new tests fail (verified by a temporary local mutation during development)"
---

# List post-delete hook guards are covered by unit tests

## Context

The list delete hook (`use-list-delete-post.ts`, unified into `use-delete-post.ts` by FG_252) introduced guards with no test coverage: `if (isSubmittingRef.current || postId == null) return` in confirm, `if (isSubmittingRef.current) return` in cancel, `if (!open && isSubmittingRef.current) return` in open-change, plus a catch arm that toasts the error and **keeps the dialog open** (a deliberate difference from the detail hook, which navigates away). `apps/mirror/features/posts/__tests__/use-delete-post.test.ts` exhaustively tests the analogous detail-hook guards but nothing covers the list mode.

Found in code review (tests reviewer, confidence 0.95). All four behaviors can be removed or inverted today without a single failing test.

## Scope

- Add Vitest coverage for the list mode (late-bound target, no `router.replace`) of the unified delete hook.

## Approach

Mirror the describe structure of `use-delete-post.test.ts` for the list mode: assert the double-submit no-op, the null-target early return, the close-while-pending block, and that a rejected mutation surfaces an error toast while `dialogOpen` stays true.

## Implementation Steps

1. (FG_252 already landed) read the unified delete hook and `apps/mirror/features/posts/__tests__/use-delete-post.test.ts` for the existing test patterns/mocks.
2. Add a describe block for the late-bound/no-router mode covering the four behaviors in the acceptance criteria.
3. Run `pnpm --filter=@feel-good/mirror run test:unit`.

## Constraints

- Depends on FG_252 (already completed): the consolidated hook is the unit under test.
