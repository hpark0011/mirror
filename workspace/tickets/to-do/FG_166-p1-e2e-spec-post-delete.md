---
id: FG_166
title: "Post delete authenticated owner E2E covers happy path, gate, and error path"
date: 2026-05-08
type: improvement
status: to-do
priority: p1
description: "The new post delete feature on branch feature-post-delete-button (`apps/mirror/features/posts/components/detail/delete-post.tsx`, `delete-post-connector.tsx`, `hooks/use-delete-post.ts`) shipped without any e2e coverage. None of the six named invariants — visitor gate, confirm-disabled-during-pending, escape/outside-click block while pending, double-submit guard, error-keeps-dialog-open, success-navigates-to-list — are protected by an automated test. The verification rule (`.claude/rules/verification.md`) treats end-to-end features as Tier 5 and requires e2e or Chrome MCP interaction. The data-post-deleting attribute that was added on the trigger button gives the test a deterministic wait surface, so the only thing missing is the spec itself."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "test -f apps/mirror/e2e/post-delete.authenticated.spec.ts"
  - "grep -nE 'data-post-deleting|waitForDataState\\(.*post-deleting' apps/mirror/e2e/post-delete.authenticated.spec.ts returns at least 1 match"
  - "grep -nE 'waitForAuthReady' apps/mirror/e2e/post-delete.authenticated.spec.ts returns at least 1 match"
  - "grep -cE 'test\\(' apps/mirror/e2e/post-delete.authenticated.spec.ts returns >= 3 (owner-confirm, owner-cancel, error-path covered minimally; visitor-gate may share the suite or be in a sibling unauthenticated spec)"
  - "pnpm --filter=@feel-good/mirror test:e2e -- post-delete passes locally"
  - "pnpm build --filter=@feel-good/mirror succeeds"
  - "pnpm lint --filter=@feel-good/mirror succeeds"
owner_agent: "Playwright E2E specialist"
---

# Post delete authenticated owner E2E covers happy path, gate, and error path

## Context

Code review of `feature-post-delete-button` (review-code Phase 6 finding `missing-e2e-post-delete`, P1) flagged the absence of any automated coverage for the new post-delete feature. The diff added four production files plus zero test files. The sibling feature has an e2e at `apps/mirror/e2e/post-publish-toggle.authenticated.spec.ts` that establishes the shape: an authenticated-owner test fixture, an `ensureTestPostFixtures` HTTP action that resets fixtures to known state, and assertions on the AlertDialog → toast → state-label flow.

Where the gap lives:

- `apps/mirror/features/posts/components/detail/delete-post.tsx:46-53` — the trigger button, now carrying `data-post-deleting={isPending ? "true" : "false"}` for deterministic e2e waits (`apps/mirror/e2e/helpers/wait-for-data-state.ts`).
- `apps/mirror/features/posts/hooks/use-delete-post.ts:37-58` — the success path (`removePosts` → toast → `setDialogOpen(false)` → `router.replace(buildChatAwareHref(getContentHref(username, "posts")))`) and the error path (toast, dialog stays open).
- `apps/mirror/features/posts/components/detail/delete-post-connector.tsx:17-20` — the visitor gate (`if (!isOwner) return null`).
- Sibling spec to mirror: `apps/mirror/e2e/post-publish-toggle.authenticated.spec.ts`.

`workspace/lessons.md` (2026-05-05) documents the auth-race lesson — every authenticated spec must call `await waitForAuthReady(page)` after `page.goto(...)` and before any Convex-mutation-triggering interaction. The `ensureTestPostFixtures` HTTP action already exists and returns `{ draftSlug, publishedSlug }`; reusing it keeps the fixture surface uniform with the publish-toggle spec.

## Goal

A new authenticated-owner Playwright spec at `apps/mirror/e2e/post-delete.authenticated.spec.ts` that exercises the post-delete flow end to end. After this ticket, a regression in any of the six named invariants — visitor gate, confirm-disabled-during-pending, escape/outside-click block while pending, double-submit guard, error-keeps-dialog-open, success-navigates-to-list — fails the suite locally and in CI.

## Scope

- Add the new spec file mirroring the structure of `post-publish-toggle.authenticated.spec.ts`.
- Reuse `ensureTestPostFixtures`, the `authenticatedPage` fixture from `apps/mirror/e2e/fixtures/auth.ts`, `waitForAuthReady`, and `waitForDataState(page, "post-deleting", "false")`.
- Cover at minimum: owner happy-path delete (toast + navigation), owner cancel (no navigation, no mutation), error-path retry (dialog stays open after a simulated rejection).
- Visitor gate (delete button absent) may be covered in this spec or in a sibling unauthenticated spec — either is acceptable so long as it exists.

## Out of Scope

- Adding the `data-post-deleting` attribute — already shipped in the same review-code round.
- Refactoring the `useDeletePost` hook for testability — see FG_167 for unit-level guard coverage.
- Smoothing the post-detail blank-flash during navigation — see FG_168.
- Backporting an equivalent spec to `articles/` — the article delete UX uses a multi-select bulk-delete pattern, not a per-detail confirm.
- Changing the existing publish-toggle spec.

## Approach

Mirror the publish-toggle spec's `test.describe` block. Each test seeds via `ensureTestPostFixtures`, navigates to `/@${username}/posts/${publishedSlug}` (or `${draftSlug}` if delete should be exercised against drafts too), waits for auth, asserts the trigger button is visible, drives the AlertDialog flow, and uses `waitForDataState(page, "post-deleting", "false")` to anchor the post-deletion assertion deterministically. The success-path test asserts the URL flips to `/@${username}/posts` (chat-aware variant if `?chat=1` is in the start URL — recommend testing the no-chat path first).

For the error-path test: either intercept the Convex mutation via Playwright `page.route(...)` and force a 500, or use a server-side fixture that triggers a known failure. The publish-toggle spec doesn't currently exercise the error path; this is a new pattern the ticket establishes.

- **Effort:** Medium
- **Risk:** Low — pure test addition, no production code changes. Failure modes are limited to test flake, mitigated by `waitForAuthReady` and `waitForDataState`.

## Implementation Steps

1. Create `apps/mirror/e2e/post-delete.authenticated.spec.ts` using `apps/mirror/e2e/post-publish-toggle.authenticated.spec.ts` as the structural template.
2. Reuse the existing `ensureTestPostFixtures` HTTP-action call and the `authenticatedPage` fixture.
3. Test 1 — owner happy path: navigate to a published post, click "Delete post" by `aria-label` or `data-testid="delete-post-btn"`, confirm in the AlertDialog, then `await waitForDataState(page, "post-deleting", "false")` and assert the URL is `/@${username}/posts`.
4. Test 2 — owner cancel: open the dialog, click Cancel, assert URL did not change and the post is still rendered (or assert the dialog closed and the trigger button is still visible).
5. Test 3 — error path: route-intercept the Convex mutation (or use a known-failure fixture) and assert the dialog stays open with an error toast after Confirm.
6. Test 4 (optional in this spec, may live in an unauthenticated sibling) — visitor gate: visit the post detail page unauthenticated and assert the delete button is not in the DOM.
7. Add `await waitForAuthReady(page)` after every `page.goto(...)` in authenticated tests.
8. Run `pnpm --filter=@feel-good/mirror test:e2e -- post-delete` locally and confirm green.
9. Run `pnpm build --filter=@feel-good/mirror` and `pnpm lint --filter=@feel-good/mirror`.

## Constraints

- Pure test addition — no edits under `apps/mirror/features/posts/` or `packages/convex/convex/posts/`.
- Must reuse `waitForDataState`, `waitForAuthReady`, `authenticatedPage`, `ensureTestPostFixtures`. Do not introduce new fixtures or helpers if the existing ones cover the surface.
- Must not use `page.waitForTimeout(...)` — `apps/mirror/eslint.config.mjs` enforces this, and `.claude/rules/verification.md` forbids it. Use `waitForDataState` or `expect(...).toBeVisible({ timeout })`.
- The error-path test must clean up its route-intercept (`page.unroute(...)`) so it doesn't leak into adjacent tests.

## Resources

- Code review report (this branch) — Finding #2, P1 High — `missing-e2e-post-delete`.
- `apps/mirror/e2e/post-publish-toggle.authenticated.spec.ts` — sibling spec, structural template.
- `apps/mirror/e2e/helpers/wait-for-data-state.ts` — the canonical deterministic wait helper.
- `apps/mirror/e2e/fixtures/auth.ts` — `authenticatedPage` fixture and `waitForAuthReady` helper.
- `.claude/rules/verification.md` — Tier 5 protocol and the no-`waitForTimeout` rule.
- `workspace/lessons.md` 2026-05-05 — Convex client-auth race in authenticated specs.
- `apps/mirror/features/posts/components/detail/delete-post.tsx` — producer of the `data-post-deleting` attribute.
