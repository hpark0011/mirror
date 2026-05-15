---
id: FG_230
title: "post-list-actions spec stops renaming the shared playwright test user"
date: 2026-05-15
type: fix
status: completed
priority: p0
branch: hpark0011/post-edit-delete
verification_tier: 4
description: "The committed post-list-actions e2e spec calls ensureTestUser in beforeEach with username 'post-list-actions-user' against the shared playwright-test@mirror.test account, renaming the canonical test-user used by every other authenticated spec. Any spec ordering that runs this file before post-delete.authenticated.spec.ts (or any other authenticated spec) causes 404s at /@test-user/posts/<slug>. Working-tree changes are in progress; commit them atomically with the spec change."
dependencies: []
acceptance_criteria:
  - "grep -n 'post-list-actions-user' apps/mirror/e2e/post-list-actions.authenticated.spec.ts returns no matches"
  - "grep -n 'ensureTestUser' apps/mirror/e2e/post-list-actions.authenticated.spec.ts returns no matches OR only matches that target a unique per-test fixture identifier (not the shared account)"
  - "pnpm --filter=@feel-good/mirror test:e2e post-list-actions.authenticated.spec.ts passes"
  - "pnpm --filter=@feel-good/mirror test:e2e post-delete.authenticated.spec.ts passes when run AFTER post-list-actions in the same session"
---

# post-list-actions spec stops renaming the shared playwright test user

## Context

Surfaced in code review of branch `hpark0011/post-edit-delete` (commit `a8b8d719`). The committed spec at `apps/mirror/e2e/post-list-actions.authenticated.spec.ts:5,84-90` declares `const username = "post-list-actions-user"` and calls `ensureTestUser({ email: "playwright-test@mirror.test", username: "post-list-actions-user" })` in `beforeEach`. The `authenticatedPage` fixture is bound to that email, and `app/api/test/session/route.ts:149` sets that account's `users.username` to `"test-user"`. Renaming the row corrupts every other authenticated spec that navigates to `/@test-user/...`.

The working tree already has an in-progress fix that switches the spec to `test-user` and adds a `username?` body param to the test-session route — they must be committed atomically.

## Scope

- Make the spec stop mutating the shared playwright user's username.
- Ensure the test-session route can take a per-test username when one is needed.
- Keep coverage equivalent to or better than what the broken spec attempted.

## Approach

Adopt the working-tree fix verbatim: pass `username?` through `/api/test/session`, change the spec to use `test-user` (the canonical authenticated user), and drop the rogue `ensureTestUser` call. If per-test isolation is wanted, use a fixtureId-style unique username AND a custom `ownerPage` fixture that creates an isolated session for it — never via the shared `authenticatedPage` storage state.

## Implementation Steps

1. Commit `apps/mirror/app/api/test/session/route.ts` working-tree change so `TestSessionRequestBody` accepts `username?: string` and `route.ts:149` forwards `body.username ?? "test-user"` to `/test/ensure-user`.
2. Commit `apps/mirror/e2e/post-list-actions.authenticated.spec.ts` working-tree change: drop `ensureTestUser` helper + `const username = "post-list-actions-user"`; use `const username = "test-user"`.
3. Run `pnpm --filter=@feel-good/mirror test:e2e post-list-actions.authenticated.spec.ts` and confirm pass.
4. Run `pnpm --filter=@feel-good/mirror test:e2e post-delete.authenticated.spec.ts` immediately after and confirm still passes.
5. Run `pnpm lint --filter=@feel-good/mirror` and `pnpm build --filter=@feel-good/mirror`.

## Constraints

- Atomic commit: the spec and route.ts changes must land together — either one without the other leaves the suite broken.
