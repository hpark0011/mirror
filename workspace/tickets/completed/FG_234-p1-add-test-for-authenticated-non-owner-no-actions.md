---
id: FG_234
title: "Add e2e test that authenticated non-owners see no post-list owner actions"
date: 2026-05-15
type: improvement
status: completed
priority: p1
branch: hpark0011/post-edit-delete
verification_tier: 4
description: "The new post-list-actions spec only covers an unauthenticated visitor (storage state cleared). Owner gating goes through useIsProfileOwner() which derives isOwner from authenticated session vs. profile authId. A regression that returned isOwner=true for a logged-in user viewing another profile would expose Edit and Delete buttons across users with no test to catch it."
dependencies:
  - FG_230
acceptance_criteria:
  - "apps/mirror/e2e/post-list-actions.authenticated.spec.ts contains a test that uses authenticatedPage (logged in as test-user) to visit a DIFFERENT user's /@<other-user>/posts and asserts both post-list-edit-btn and post-list-delete-btn are NOT visible after hovering a row"
  - "The new test passes locally: pnpm --filter=@feel-good/mirror test:e2e post-list-actions.authenticated.spec.ts"
  - "The existing visitor (unauthenticated) test still passes"
---

# Add e2e test that authenticated non-owners see no post-list owner actions

## Context

Surfaced in code review of branch `hpark0011/post-edit-delete`. The spec at `apps/mirror/e2e/post-list-actions.authenticated.spec.ts` ends with `test("visitor hover does not reveal owner actions", ...)` which uses `browser.newContext({ storageState: { cookies: [], origins: [] } })` — fully unauthenticated. The owner-gating chain (`apps/mirror/features/posts/components/list/post-list-item-actions.tsx:28` and `apps/mirror/features/posts/components/actions/delete-post-connector.tsx:24`) reads `isOwner` from React context populated by `useIsProfileOwner()` (`apps/mirror/features/profile/context/profile-context.tsx`). The authenticated cross-user path is the riskier regression surface and is currently untested.

## Scope

- Add one e2e test: logged-in `test-user` visits another user's profile post list, hovers a row, confirms no Edit/Delete buttons appear.

## Approach

Either (a) use a second test fixture user already created by the test-fixture infrastructure, or (b) seed a second user fixture via the existing `/test/ensure-user` HTTP action. The test must reuse `authenticatedPage` (already logged in as `test-user`) and navigate to `/@<other-username>/posts`.

## Implementation Steps

1. Identify a second profile with at least one published post (or seed one via `/test/ensure-post-fixtures` with a different email).
2. Add a new test inside `test.describe.serial("Post list item actions", ...)` that uses `authenticatedPage`, navigates to `/@<other-username>/posts`, waits for `waitForAuthReady`, hovers a row, and asserts both `post-list-edit-btn` and `post-list-delete-btn` are not visible.
3. Run `pnpm --filter=@feel-good/mirror test:e2e post-list-actions.authenticated.spec.ts` and verify the new test passes and existing ones still pass.

## Constraints

- Depends on FG_230 landing first; otherwise the spec's shared-user corruption obscures any new test.
