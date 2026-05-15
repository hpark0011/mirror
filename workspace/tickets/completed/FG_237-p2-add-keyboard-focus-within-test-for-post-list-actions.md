---
id: FG_237
title: "Add e2e test exercising keyboard focus reveal of post-list owner actions"
date: 2026-05-15
type: improvement
status: completed
priority: p2
branch: hpark0011/post-edit-delete
verification_tier: 4
description: "post-list-item-actions.tsx uses both group-hover/post-item:flex AND group-focus-within/post-item:flex to reveal the action overlay. The new spec exercises only row.hover() — the keyboard accessibility branch is untested. Removing or misspelling the focus-within class would silently break keyboard reveal with no test catching it."
dependencies:
  - FG_230
acceptance_criteria:
  - "apps/mirror/e2e/post-list-actions.authenticated.spec.ts contains a test that uses page.keyboard.press('Tab') (or focus()) to land keyboard focus inside a post row and asserts post-list-edit-btn becomes visible WITHOUT calling row.hover()"
  - "The new test passes locally: pnpm --filter=@feel-good/mirror test:e2e post-list-actions.authenticated.spec.ts"
  - "Existing hover-based test still passes"
---

# Add e2e test exercising keyboard focus reveal of post-list owner actions

## Context

Surfaced in code review of branch `hpark0011/post-edit-delete`. The implementation plan in `workspace/plans/2026-05-15-post-list-edit-delete-actions-plan.md` calls out keyboard accessibility explicitly: "Do not rely on hover alone for accessibility. `group-focus-within` is required." The component honors this at `apps/mirror/features/posts/components/list/post-list-item-actions.tsx:32` but the e2e spec only exercises `row.hover()`.

## Scope

- One new test in the existing `describe.serial` block that drives reveal via keyboard focus rather than hover.

## Approach

Tab into an interactive element inside the row (the cover link or title `<Link>`), then assert `post-list-edit-btn` is visible.

## Implementation Steps

1. Inside `apps/mirror/e2e/post-list-actions.authenticated.spec.ts`, add a test that navigates to `/@test-user/posts`, calls `waitForAuthReady`, then `page.keyboard.press('Tab')` repeatedly (or focus via `page.locator(...).first().focus()`) until focus lands inside the target row.
2. Without calling `row.hover()`, assert `row.getByTestId("post-list-edit-btn")` is visible.
3. Run `pnpm --filter=@feel-good/mirror test:e2e post-list-actions.authenticated.spec.ts`.
