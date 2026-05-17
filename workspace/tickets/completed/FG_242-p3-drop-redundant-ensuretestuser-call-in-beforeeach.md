---
id: FG_242
title: "Drop redundant ensureTestUser call in post-list-actions spec beforeEach"
date: 2026-05-15
type: refactor
status: completed
priority: p3
branch: hpark0011/post-edit-delete
verification_tier: 4
description: "The ownerPage fixture in post-list-actions.authenticated.spec.ts calls /api/test/session, which internally calls /test/ensure-user. test.beforeEach then calls ensureTestUser() again. Two HTTP round-trips per test for the same idempotent setup. Future readers will be uncertain whether the double call is load-bearing."
dependencies:
  - FG_230
acceptance_criteria:
  - "apps/mirror/e2e/post-list-actions.authenticated.spec.ts contains no ensureTestUser() call inside test.beforeEach (only ensureTestPostFixtures or other per-test seeding)"
  - "pnpm --filter=@feel-good/mirror test:e2e post-list-actions.authenticated.spec.ts passes"
---

# Drop redundant ensureTestUser call in post-list-actions spec beforeEach

## Context

Surfaced in code review of branch `hpark0011/post-edit-delete`. Per the committed spec at `apps/mirror/e2e/post-list-actions.authenticated.spec.ts:14-37,87-91`, the `ownerPage` fixture posts to `/api/test/session`, which (per `app/api/test/session/route.ts:149-170`) always calls `/test/ensure-user`. Then `test.beforeEach` calls `ensureTestUser()` directly. The two calls are redundant; the session route already guarantees the user row.

## Scope

- Remove the `ensureTestUser()` call from `beforeEach`.
- Keep only `ensureTestPostFixtures()`.

## Approach

After FG_230 lands, the spec's session fixture (or `authenticatedPage`) is the single source of truth for the user row. `beforeEach` only needs to re-seed posts, not the user.

## Implementation Steps

1. Land FG_230 first so the spec is stable.
2. In `apps/mirror/e2e/post-list-actions.authenticated.spec.ts`, delete the `ensureTestUser()` call inside `test.beforeEach`. Delete the helper function definition if no longer referenced.
3. Run `pnpm --filter=@feel-good/mirror test:e2e post-list-actions.authenticated.spec.ts`.

## Constraints

- Land after FG_230 — that ticket may rewrite the helper anyway.
