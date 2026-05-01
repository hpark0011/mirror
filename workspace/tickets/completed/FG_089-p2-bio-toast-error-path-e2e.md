---
id: FG_089
title: "Bio submit toast error path is covered by an E2E"
date: 2026-05-01
type: improvement
status: completed
priority: p2
description: "The bio refactor deleted BioFormError and routed all server-rejection error UX through showToast() in use-bio-panel-handlers.ts. With the dialog now closing synchronously, the toast is the only user-visible error surface for write failures. No bio E2E asserts that path — getMutationErrorMessage returning empty, showToast being mis-called, or the dialog not actually closing on rejection would all ship silently. Add a Playwright test that forces a server-side mutation rejection and asserts (a) the dialog is not visible after submit and (b) a toast with the rejection message appears."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "grep -nE 'data-sonner-toast|role=\"status\"' apps/mirror/e2e/bio/ returns at least 1 match in a new test in bio-tab-owner-crud.authenticated.spec.ts"
  - "The new test forces a server-side rejection — use page.route() to intercept the Convex mutation HTTP path and reply with an error, OR use ensureBioFixtures + a direct mutation call that bypasses canCreateEntry to push the user past the soft cap"
  - "The new test asserts the dialog (page.getByRole('dialog')) is not visible within 5_000 ms of submit click — this proves the synchronous-close invariant"
  - "The new test asserts the toast text matches the rejection message (e.g. 'Bio entry limit reached (50)' or whatever the forced error returns)"
  - "pnpm --filter=@feel-good/mirror test:e2e -- bio/bio-tab-owner-crud passes locally"
  - "pnpm build --filter=@feel-good/mirror and pnpm lint --filter=@feel-good/mirror succeed"
owner_agent: "Playwright E2E specialist"
---

# Bio submit toast error path is covered by an E2E

## Context

Code review of the bio optimistic-updates branch flagged a coverage gap on the new error surface. Pre-refactor, server rejections rendered an inline `<BioFormError message={formError} />` inside the dialog (`apps/mirror/features/bio/components/bio-form-error.tsx`, DELETED in this branch). Post-refactor:

- The dialog closes synchronously on submit (`use-bio-panel-handlers.ts:60`).
- Server rejections surface via `showToast({ type: "error", title: getMutationErrorMessage(err) })` (`use-bio-panel-handlers.ts:69`).

The toast is now the only user-visible signal that a write failed. The rule file the same diff added (`.claude/rules/optimistic-updates.md` § Submit-flow UX) makes this the canonical pattern: "Errors surface via toast, not inline. With the dialog gone, an inline formError slot is unreachable."

Existing bio E2E coverage (`apps/mirror/e2e/bio/bio-tab-owner-crud.authenticated.spec.ts`):

- FR-04, FR-07, FR-08 cover the happy paths (create/edit/delete + reorder + persistence).
- No test asserts the rejection path — neither the toast appearing nor the synchronous dialog close on rejection.

A repo-wide grep confirms the pattern is supported in Playwright: `apps/mirror/e2e/video-call.spec.ts:147-150` and `apps/mirror/e2e/post-publish-toggle.authenticated.spec.ts` already use Sonner-toast selectors. A regression in `getMutationErrorMessage`, `showToast`, or the synchronous-close ordering would currently ship with no automated detection.

## Goal

A new authenticated-owner test in `bio-tab-owner-crud.authenticated.spec.ts` triggers a deterministic server-side mutation rejection and asserts (a) the dialog is not visible immediately after submit click (synchronous-close invariant), and (b) a toast appears with the rejection message. The toast-error contract for bio writes has explicit regression protection.

## Scope

- Add one new test inside the existing `test.describe` block in `apps/mirror/e2e/bio/bio-tab-owner-crud.authenticated.spec.ts`.
- The test forces a server-side rejection through a deterministic, repo-aligned mechanism (see Approach for two options).
- The test asserts both the dialog-closed and the toast-visible invariants.
- The test does NOT mutate any production code.

## Out of Scope

- Refactoring `getMutationErrorMessage` (`apps/mirror/features/bio/utils/mutation-helpers.ts`) — out of scope.
- Adding a unit test for `getMutationErrorMessage` — separate ticket if desired.
- Coverage for the delete-error toast path; FG_088 prevents the most common cause and an E2E for the remaining edge cases (cross-user / stale-tab) is lower-value.
- Coverage for the Add button disabled-at-cap state — that is FG_086's territory.

## Approach

Two ways to force the rejection deterministically. Pick the one that lands cleanly given the suite's existing harness; do not implement both.

**Option A (network intercept):** Use Playwright's `page.route()` to intercept the Convex mutation HTTP path (`/api/...mutation` or whichever URL the Convex client uses — confirm by inspecting a recorded request in the existing FR-04 test) and reply with a `ConvexError`-shaped body so `getMutationErrorMessage` returns a known string. Pros: fully deterministic, no state setup. Cons: brittle to Convex SDK URL changes; check if other repo tests use this pattern before adopting.

**Option B (state-driven):** Seed exactly 50 entries via `ensureBioFixtures`, then in the test directly invoke the Convex `bio.mutations.create` from the page context (`page.evaluate`) bypassing the React `canCreateEntry` gate, OR temporarily lower `MAX_BIO_ENTRIES` for one test via a fixture-level override. Pros: exercises the real server validator. Cons: requires either a new override mechanism or an awkward `page.evaluate` of the Convex client.

**Default: Option A.** Inspect the Convex network calls in the existing FR-08 test to extract the URL pattern, then `page.route()` the mutation endpoint to return `{ status: 409, body: JSON.stringify({ message: "Forced error for E2E" }) }` or whatever shape `ConvexError` expects. If Option A fails because Convex's transport doesn't expose a clean URL boundary, fall back to Option B.

- **Effort:** Small (Option A) / Medium (Option B)
- **Risk:** Low — pure test addition.

## Implementation Steps

1. Inspect existing FR-04 / FR-08 test runs (`pnpm --filter=@feel-good/mirror test:e2e -- bio/bio-tab-owner-crud --headed --debug`) to confirm the Convex mutation URL pattern OR confirm the Convex client URL surface in `apps/mirror/lib/convex.ts` / `packages/convex/convex/_generated/api.d.ts`.
2. Add a new test in `apps/mirror/e2e/bio/bio-tab-owner-crud.authenticated.spec.ts`. Suggested name: `"FR-09: server rejection on submit closes dialog and shows error toast"`.
3. Inside the test:
   a. `setupScenarioUser` + `ensureBioFixtures` with 1-2 baseline entries.
   b. Set up `page.route()` to intercept the create mutation and reply with a forced error (Option A), OR navigate to the page first and follow Option B if Option A is blocked.
   c. Navigate, wait for `bio-panel` and auth.
   d. Click `bio-add-entry-button` to open the dialog. Fill required fields (title, kind, startDate via the existing form field selectors).
   e. Click the Save / Add button.
   f. Within 5_000 ms, assert `await expect(page.getByRole("dialog")).not.toBeVisible();` — the synchronous-close invariant.
   g. Assert `await expect(page.locator('[data-sonner-toast]').filter({ hasText: /Forced error for E2E|<your forced message>/ })).toBeVisible({ timeout: 5_000 });` — adjust the selector to match the repo's toast-component DOM (cross-reference `video-call.spec.ts:147-150` for the working pattern).
4. Run the test in isolation: `pnpm --filter=@feel-good/mirror test:e2e -- bio/bio-tab-owner-crud -g "FR-09"`.
5. Run `pnpm build --filter=@feel-good/mirror` and `pnpm lint --filter=@feel-good/mirror`.

## Constraints

- Pure test addition. No edits under `apps/mirror/features/bio/`, `apps/mirror/lib/`, or `packages/convex/`.
- Must use the suite's existing helpers (`setupScenarioUser`, `ensureBioFixtures`, `waitForAuthReady`) — do not introduce new fixtures.
- The forced error message must be a literal string matchable by `expect.toContainText` — no dynamic timestamps or IDs.
- Avoid `page.waitForTimeout` — the suite already has one at line 64; do not propagate the pattern. Use `expect.poll` or `toBeVisible({ timeout })`.
- The test name must include the FR identifier (e.g. `FR-09`) for grep-discoverability with the rest of the suite.

## Manual Verification

Run the test locally and confirm: (a) the test fails if you temporarily delete the `try/catch` in `use-bio-panel-handlers.ts:62-70` (no toast on rejection), and (b) the test fails if you temporarily move `setDialog({ open: false })` to AFTER `await ...` in the same handler (dialog stays open on rejection). Both negative confirmations validate the test catches real regressions on the invariants it claims to cover.

## Resources

- Code review report (this branch) — Finding #4, P2 Moderate, tests reviewer.
- `apps/mirror/e2e/video-call.spec.ts:147-150` — working precedent for Sonner toast selectors.
- `apps/mirror/e2e/bio/bio-tab-owner-crud.authenticated.spec.ts` — host suite with `setupScenarioUser`, `ensureBioFixtures`, `waitForAuthReady`.
- `apps/mirror/features/bio/hooks/use-bio-panel-handlers.ts:52-73` — the synchronous-close + toast contract under test.
- `apps/mirror/features/bio/utils/mutation-helpers.ts` — `getMutationErrorMessage` source for the toast text format.
- `.claude/rules/testing.md` — Playwright CLI only; no MCP browser tools.
