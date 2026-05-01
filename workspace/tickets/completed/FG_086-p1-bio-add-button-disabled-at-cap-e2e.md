---
id: FG_086
title: "Bio Add button disabled-at-cap state is covered by an owner E2E"
date: 2026-05-01
type: improvement
status: completed
priority: p1
description: "The bio optimistic-updates refactor introduced a precondition gate: when entries.length >= 50, the BioAddEntryButton renders disabled with a tooltip ('Bio entry limit reached (50). Delete an entry to add another.'). This is the central behavioral change of the refactor — it replaces the deleted BioFormError recovery flow. Existing E2E coverage misses it: bio-tab-public.spec.ts FR-10 only asserts the visitor read-side cap (toHaveCount(50)), and bio-tab-owner-crud.authenticated.spec.ts FR-04 only asserts the Add button is visible. A regression that silently drops the canCreateEntry wire-up would not be caught. Add an authenticated owner test that seeds exactly 50 entries and asserts both the disabled state and the tooltip text."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "grep -n 'toBeDisabled' apps/mirror/e2e/bio/bio-tab-owner-crud.authenticated.spec.ts returns at least 1 match referencing bio-add-entry-button"
  - "grep -n 'Bio entry limit reached' apps/mirror/e2e/bio/bio-tab-owner-crud.authenticated.spec.ts returns at least 1 match (the tooltip-text assertion)"
  - "grep -n 'ensureBioFixtures' apps/mirror/e2e/bio/bio-tab-owner-crud.authenticated.spec.ts shows a seed of 50 entries in the new test"
  - "pnpm --filter=@feel-good/mirror test:e2e -- bio/bio-tab-owner-crud passes locally"
  - "pnpm build --filter=@feel-good/mirror succeeds"
  - "pnpm lint --filter=@feel-good/mirror succeeds"
owner_agent: "Playwright E2E specialist"
---

# Bio Add button disabled-at-cap state is covered by an owner E2E

## Context

Code review of the bio optimistic-updates branch (`feature-socials`, last 2 commits + uncommitted) flagged a coverage gap on the new precondition UX. The refactor at `apps/mirror/features/bio/hooks/use-bio-entries.ts:156` derives `canCreateEntry = entries.length < MAX_BIO_ENTRIES` from the same Convex query the panel reads, and `apps/mirror/features/bio/components/bio-panel.tsx:23-26` composes the disabled-reason string and threads it through `BioAddEntryButton`. `BioAddEntryButton` (`apps/mirror/features/bio/components/bio-add-entry-button.tsx:36-48`) wraps the disabled `<Button>` in a Radix Tooltip when `disabled && disabledReason` are both truthy.

This is the primary UX invariant introduced by the refactor — it replaces the deleted `BioFormError` post-submit recovery flow (`apps/mirror/features/bio/components/bio-form-error.tsx` — DELETED in this branch) — and the rule file the same diff adds (`.claude/rules/optimistic-updates.md` § Preconditions) makes the pattern canonical.

Existing coverage:

- `apps/mirror/e2e/bio/bio-tab-public.spec.ts:241-267` (FR-10) seeds 51 entries as a visitor and asserts `cards.toHaveCount(50)`. This is the visitor read-side cap. It never authenticates as the owner and never inspects the Add button.
- `apps/mirror/e2e/bio/bio-tab-owner-crud.authenticated.spec.ts` FR-04 asserts the Add button is `toBeVisible()`. It does not assert `toBeDisabled()` and does not check the tooltip text.

Per `workspace/lessons.md` ("Build passing is not verification for auth/data flows. Always load the page in a browser and confirm the actual user-visible behavior"), a regression that silently dropped the `canCreateEntry` wire-up — for example, by reverting `bio-panel.tsx` to the pre-refactor `<BioAddEntryButton onClick={openCreate} />` — would compile, lint, and pass the existing test suite while shipping a broken cap UX.

## Goal

A single authenticated-owner Playwright test in `apps/mirror/e2e/bio/bio-tab-owner-crud.authenticated.spec.ts` seeds 50 bio entries, navigates to the bio tab, and asserts (a) `bio-add-entry-button` is disabled, and (b) hovering the wrapper renders the tooltip with the literal text "Bio entry limit reached (50). Delete an entry to add another." A future regression that drops the gate fails this test.

## Scope

- Add one new test inside the existing `test.describe` block in `apps/mirror/e2e/bio/bio-tab-owner-crud.authenticated.spec.ts` covering the 50-entry owner-disabled state.
- The test seeds 50 distinct entries via the existing `ensureBioFixtures` helper (the helper already supports authenticated-owner seeding via `setupScenarioUser` — see `bio-tab-public.spec.ts:241-267` for the seed shape).
- The test asserts both the `bio-add-entry-button` disabled state AND the tooltip-content text.
- The test does NOT mutate any production code paths; it is a pure coverage addition.

## Out of Scope

- Adding coverage for the toast error path that replaced `BioFormError` (FG_089's territory).
- Refactoring `BioAddEntryButton` to compose the disabled-reason string itself instead of receiving it as a prop.
- Adding a 51st-create test that exercises the server-side soft-cap throw — the gate is meant to make that path unreachable from the UI.
- Backporting the test to `bio-tab-public.spec.ts` — the visitor never sees the Add button.
- Lifting `MAX_BIO_ENTRIES` somewhere shared with the test file — the literal `50` is acceptable in the assertion (mirrors what the user sees).

## Approach

Hover-driven Radix tooltips render a `[role="tooltip"]` element only after the trigger receives pointer or focus events. The wrapper `<span tabIndex={0}>` in `bio-add-entry-button.tsx:42` exists precisely so the tooltip trigger can receive events when the underlying `<button>` is disabled. Drive the tooltip with `page.getByTestId("bio-add-entry-button").locator("..").hover()` — hovering the wrapper span — and then assert `page.getByRole("tooltip", { name: /Bio entry limit reached/ })` becomes visible.

Seed shape: 50 entries with descending `startDate` so sorting is deterministic. The existing FR-10 test already uses `Array.from({ length: N }, ...)` with `monthEpoch(2020 + Math.floor(i / 12), (i % 12) + 1)` — reuse that pattern with `length: 50`.

- **Effort:** Small
- **Risk:** Low — pure test addition; no production code changes. Failure modes are limited to test flake (handle via the existing `waitForAuthReady` / `bio-panel` visibility waits already used in the suite).

## Implementation Steps

1. In `apps/mirror/e2e/bio/bio-tab-owner-crud.authenticated.spec.ts`, add a new test inside the existing `test.describe` block. Suggested name: `"FR-04b: Add button is disabled with tooltip when owner has 50 entries"`.
2. Inside the test: call the existing setup pattern (`setupScenarioUser` if needed for an isolated scenario, otherwise reuse the suite's authenticated context), then `ensureBioFixtures` with an array of 50 entries (use the `monthEpoch` + descending-month pattern from `bio-tab-public.spec.ts:249-259`).
3. Navigate via the suite's existing `gotoBio`/`page.goto(\`/@${username}/bio\`)` pattern, wait for `bio-panel` visibility, and `waitForAuthReady`.
4. Assert `await expect(page.getByTestId("bio-add-entry-button")).toBeDisabled({ timeout: 5_000 });` (or `.first()` if multiple — there are two render sites in `bio-panel.tsx`: the header and the empty-state, but at 50 entries the empty-state is not rendered, so a single match is expected).
5. Hover the wrapper span (`page.getByTestId("bio-add-entry-button").locator("xpath=..").hover()`) and assert `await expect(page.getByRole("tooltip")).toContainText("Bio entry limit reached (50). Delete an entry to add another.", { timeout: 3_000 });`
6. Run `pnpm --filter=@feel-good/mirror test:e2e -- bio/bio-tab-owner-crud` and confirm green.
7. Run `pnpm build --filter=@feel-good/mirror` and `pnpm lint --filter=@feel-good/mirror`.

## Constraints

- Pure test addition — no edits under `apps/mirror/features/bio/` or `packages/convex/convex/bio/`.
- Must reuse the suite's existing `ensureBioFixtures`, `setupScenarioUser`, `waitForAuthReady`, and `monthEpoch` helpers. Do not introduce new fixtures.
- Test must be deterministic — avoid `waitForTimeout` (the suite already has one at line 64; do not propagate the pattern). Use `expect.poll` or `toBeVisible({ timeout })` for waits.
- The tooltip text assertion must match the literal string composed in `bio-panel.tsx:24-26` byte-for-byte; if the copy changes, update both sites in the same commit.

## Manual Verification

The deterministic acceptance_criteria cover the structural test additions (greps + e2e + build + lint). For local manual verification, also confirm via Chrome MCP at `http://localhost:3001/@<seeded-owner>/bio` that hovering the disabled button shows the tooltip with the expected text — this validates the test selector strategy is correct against the live Radix DOM, since Radix tooltip rendering can be sensitive to portal mounting.

## Resources

- Code review report (this branch) — Finding #1, P1 High.
- `.claude/rules/optimistic-updates.md` § Preconditions — the canonical pattern this test guards.
- `apps/mirror/e2e/bio/bio-tab-public.spec.ts:241-267` — FR-10, the precedent seed pattern for N entries.
- `apps/mirror/features/bio/components/bio-add-entry-button.tsx:36-48` — the tooltip-wrapped disabled state under test.
- `.claude/rules/testing.md` — Playwright CLI is the only supported e2e harness; no MCP/browser-automation MCP tools.
