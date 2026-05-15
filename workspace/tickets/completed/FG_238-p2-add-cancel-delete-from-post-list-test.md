---
id: FG_238
title: "Add e2e test for canceling the delete dialog from the post list"
date: 2026-05-15
type: improvement
status: completed
priority: p2
branch: hpark0011/post-edit-delete
verification_tier: 4
description: "post-list-actions.authenticated.spec.ts covers the confirm-delete path but not the cancel path. The existing post-delete.authenticated.spec.ts has a cancel test for the detail toolbar but not the list. A regression where cancel-from-list triggers optimistic removal or unexpected navigation would not be caught by any test."
dependencies:
  - FG_230
acceptance_criteria:
  - "apps/mirror/e2e/post-list-actions.authenticated.spec.ts contains a test that hovers a row, clicks post-list-delete-btn, clicks Cancel in the alertdialog, then asserts: row is still visible, post-list-delete-btn is still mounted (idle), no 'Post deleted' toast appears, URL is unchanged"
  - "pnpm --filter=@feel-good/mirror test:e2e post-list-actions.authenticated.spec.ts passes"
---

# Add e2e test for canceling the delete dialog from the post list

## Context

Surfaced in code review of branch `hpark0011/post-edit-delete`. The new spec at `apps/mirror/e2e/post-list-actions.authenticated.spec.ts:167-196` exercises only the confirm-delete path. The sibling spec `apps/mirror/e2e/post-delete.authenticated.spec.ts:94` has a "owner can cancel the delete dialog — no mutation, no navigation" test for the detail toolbar. The list-level cancel path uses the same components but a different context (row stays mounted on cancel; no navigation expected).

## Scope

- One new test in the existing `describe.serial` block: hover → delete → cancel → assert state unchanged.

## Approach

Mirror the cancel-path assertions from `post-delete.authenticated.spec.ts:94-139`, but on the list page: the row should remain visible after cancel, the delete button should still be there, and no toast should appear.

## Implementation Steps

1. In `apps/mirror/e2e/post-list-actions.authenticated.spec.ts`, add a test that goes to `/@test-user/posts`, calls `waitForAuthReady`, locates the row, hovers, clicks `post-list-delete-btn`.
2. Wait for `page.getByRole("alertdialog")` to be visible; click the Cancel button (`{ name: /^cancel$/i }`).
3. Assert: alertdialog is dismissed, `row` is still visible, `row.getByTestId("post-list-delete-btn")` is still mounted, no `Post deleted` toast.
4. Run `pnpm --filter=@feel-good/mirror test:e2e post-list-actions.authenticated.spec.ts`.
