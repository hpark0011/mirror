---
id: FG_094
title: "Inline-image lifecycle E2E specs run end-to-end against a real Convex backend"
date: 2026-05-02
type: fix
status: completed
priority: p1
description: "Seven of eight Playwright specs added by the inline-image-lifecycle wave are marked test.fixme citing a Convex client-auth race in the test environment. The result: FR-01, FR-02, FR-03, FR-06, FR-07, FR-08 have no running browser-stack verification. Only the size-limit and MIME-limit specs (which exercise pre-Convex client validation only) actually run. Resolve the auth race or replace the affected assertions with a deterministic Convex-test fixture path so the full inline-image lifecycle has running coverage."
dependencies: [FG_153, FG_154]
parent_plan_id: workspace/spec/2026-04-30-tiptap-inline-image-lifecycle-spec.md
acceptance_criteria:
  - "grep -rn 'test.fixme' apps/mirror/e2e/article-inline-image-* apps/mirror/e2e/post-inline-image-* apps/mirror/e2e/post-markdown-image-import.authenticated.spec.ts returns 0 matches (all 7 fixme'd specs un-skipped)"
  - "pnpm --filter=@feel-good/mirror test:e2e -- article-inline-image-paste passes"
  - "pnpm --filter=@feel-good/mirror test:e2e -- article-inline-image-cascade-delete passes"
  - "pnpm --filter=@feel-good/mirror test:e2e -- post-markdown-image-import passes"
  - "All 8 inline-image specs (paste, drop, replace, cascade-delete, size-limit, mime-limit, post-paste, post-markdown-import) pass when run in isolation. Full-suite default-parallel greenness in CI is gated on FG_154 (inline-image-fixture-pollution); cite that ticket here once it lands."
  - "Root cause of the original Convex client-auth race is documented in workspace/lessons.md or a code comment in the affected fixture"
owner_agent: "Playwright E2E specialist"
---

# Inline-image lifecycle E2E specs run end-to-end against a real Convex backend

## Context

ce:review (`feature-add-editor`, 2026-05-02) Finding #5, testing reviewer at confidence 0.95. Inventory:

| Spec | Status | What it should verify |
|------|--------|----------------------|
| `article-inline-image-paste.authenticated.spec.ts:88` | `test.fixme` | FR-01/02/03 paste → upload → save round-trip |
| `article-inline-image-drop.authenticated.spec.ts:89` | `test.fixme` | drop → upload → save |
| `article-inline-image-replace.authenticated.spec.ts:66` | `test.fixme` | FR-06 multiset diff on save |
| `article-inline-image-cascade-delete.authenticated.spec.ts:64` | `test.fixme` | FR-07 cascade delete |
| `article-inline-image-size-limit.authenticated.spec.ts` | RUNS | FR-11 size cap (pre-Convex) |
| `article-inline-image-mime-limit.authenticated.spec.ts` | RUNS | FR-11 MIME cap (pre-Convex) |
| `post-inline-image-paste.authenticated.spec.ts:78` | `test.fixme` | mirror of paste |
| `post-markdown-image-import.authenticated.spec.ts:108` | `test.fixme` | FR-08 markdown import |

The cited blocker is a Convex client-auth race in the test environment — at the moment a test calls into a Convex mutation, the client-side auth token may not have been installed yet, so the mutation throws "Not authenticated" mid-flight.

`workspace/lessons.md` 2026-02-24 entry already names this class of failure: "Build passing is not verification for auth/data flows." We're shipping a major write surface with no running E2E.

## Goal

After this ticket, all 8 inline-image E2E specs run their primary assertions against a live Convex backend (or convex-test), and a regression to any of FR-01/02/03/06/07/08 surfaces in CI rather than production.

## Scope

- Resolve the Convex client-auth race blocker — likely a `waitForAuthReady` helper or a `convexClient.action(...)` precondition wait in the auth fixture (`apps/mirror/e2e/fixtures/auth.ts`).
- Un-fixme the 7 affected specs.
- Confirm each spec's assertions actually exercise the FR they cite.
- Document the auth-readiness pattern in `workspace/lessons.md` (or in the fixture) so future authenticated specs don't reintroduce the race.

## Out of Scope

- Adding new specs beyond the spec's 8 — coverage gaps for drop unit / NFR-03 perf are tracked separately (FG_108).
- Resolving any pre-existing fixme'd specs outside the inline-image lifecycle scope.
- Migrating away from Playwright — `.claude/rules/testing.md` mandates Playwright CLI.

## Approach

Investigate the race first, fix it once, then unblock all seven specs in a single commit. Likely root cause is an `expect(authState).toBeReady()`-equivalent missing before the editor is interacted with. The pattern from `apps/mirror/e2e/post-cover-image.authenticated.spec.ts:144-166` is referenced in the testing reviewer's note as the source of the workaround — read it first to confirm the suspect pattern.

If the race truly cannot be resolved at the client level, the fallback is to seed test articles via Convex mutations directly (bypass the browser auth flow) and assert the resulting body shape via Convex queries — but this loses true browser-stack coverage. Prefer fixing the race.

- **Effort:** Medium (auth race resolution unknown until investigated)
- **Risk:** Medium — if the race is environmental (CI vs local), the fix may need orchestration changes

## Implementation Steps

1. Read `apps/mirror/e2e/fixtures/auth.ts` and `apps/mirror/e2e/post-cover-image.authenticated.spec.ts:144-166` to identify the suspect pattern.
2. Reproduce the race locally: un-fixme `article-inline-image-paste.authenticated.spec.ts:88` and run it. Observe the failure mode (likely "Not authenticated" thrown by mutation).
3. Add a `waitForAuthReady(page)` helper to the auth fixture that polls `convexClient.getCurrentUser()` (or equivalent) until it returns non-null. Call it after `setupScenarioUser` and before the first editor interaction in every affected spec.
4. Un-fixme each spec one at a time, run it, fix any spec-specific issues.
5. Run all 8 specs together: `pnpm --filter=@feel-good/mirror test:e2e -- inline-image` and confirm green.
6. Run all 8 in CI to confirm headless / parallel-worker stability.
7. Document the pattern in `workspace/lessons.md` (or extend the existing "auth-flow verification" entry).

## Constraints

- Must use Playwright CLI only (`.claude/rules/testing.md`) — no MCP browser automation in tests.
- The fix must be at the fixture/helper level, not per-spec — avoid copy-pasting wait logic into 7 specs.
- Specs must continue to assert the storage outcome (body contains storageId, blob exists, etc.), not just UI.

## Resources

- ce:review run artifact: `.context/compound-engineering/ce-review/2026-05-02-feature-add-editor/findings.md` Finding #5.
- `workspace/lessons.md` 2026-02-24 — "Build passing is not verification for auth/data flows."
- `apps/mirror/e2e/post-cover-image.authenticated.spec.ts:144-166` — likely contains the workaround pattern.
- `apps/mirror/e2e/fixtures/auth.ts` — auth fixture entry point.
