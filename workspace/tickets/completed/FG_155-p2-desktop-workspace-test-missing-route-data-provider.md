---
id: FG_155
title: "DesktopWorkspace pending-navigation tests pass without ProfileRouteDataProvider"
date: 2026-05-06
type: fix
status: completed
priority: p2
description: "Four unit tests in apps/mirror/app/[username]/_components/__tests__/desktop-workspace.test.tsx (the FG_075 pending-navigation recovery suite) fail with 'useProfileRouteData must be used within ProfileRouteDataProvider'. WorkspaceInteractionPanel now reads from useProfileRouteData() but the test harness mounts DesktopWorkspace without wrapping it in ProfileRouteDataProvider. Confirmed pre-existing on parent commit 0780702e (refactor articles extract ArticleEditorToolbar from editor shell), so this is unrelated to the article-components reorg currently in flight on the improvements-article-editor branch."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "All 4 desktop-workspace pending-navigation tests pass when running pnpm --filter=@feel-good/mirror test:unit"
  - "pnpm --filter=@feel-good/mirror test:unit reports Tests 153 passed (153) with 0 failures (matches the pre-regression count of 149 + 4)"
  - "grep -E 'useProfileRouteData|ProfileRouteDataProvider' apps/mirror/app/[username]/_components/__tests__/desktop-workspace.test.tsx returns at least one match (provider wrap or context mock is now wired in the test harness)"
  - "pnpm --filter=@feel-good/mirror build exits 0"
  - "pnpm --filter=@feel-good/mirror lint produces 0 errors"
owner_agent: "React unit-test harness fixer"
---

# DesktopWorkspace pending-navigation tests pass without ProfileRouteDataProvider

## Context

Four unit tests under the describe block `DesktopWorkspace pending-navigation recovery (FG_075)` in `apps/mirror/app/[username]/_components/__tests__/desktop-workspace.test.tsx` fail when running `pnpm --filter=@feel-good/mirror test:unit`. The failing tests are:

1. `re-invokes onOpenDefaultContent after the timeout fallback clears the latch when hasContentRoute never transitions`
2. `clears the pending-navigation latch when hasContentRoute transitions true → false mid-flight`
3. `preserves the double-invocation guard during the legitimate in-flight window`
4. `cancels the fallback timeout on unmount so it does not touch a dead ref`

All four fail with the same error:

```
Error: useProfileRouteData must be used within ProfileRouteDataProvider
 ❯ useProfileRouteData app/[username]/_providers/profile-route-data-context.tsx:38:11
 ❯ WorkspaceInteractionPanel app/[username]/_components/workspace-panels.tsx:81:5
```

`WorkspaceInteractionPanel` (rendered transitively by `DesktopWorkspace`) now calls `useProfileRouteData()`, but the test harness mounts `DesktopWorkspace` without wrapping it in `ProfileRouteDataProvider`. Either the consumer was added to `WorkspaceInteractionPanel` after the test was written, or the provider-wrap was dropped from the test setup during a refactor.

Failure was confirmed pre-existing on parent commit `0780702e refactor(articles): extract ArticleEditorToolbar from editor shell` — the failures reproduce on a clean checkout of that commit with no working changes applied, so this is not caused by the in-flight article-components reorg on `improvements-article-editor`. Result on both HEAD and parent: `Test Files 1 failed | 19 passed (20)`, `Tests 4 failed | 149 passed (153)`.

The original FG_075 ticket (now in `workspace/tickets/completed/`) added these tests to lock in the pending-navigation recovery fix. Restoring them is important because they cover the FG_075 stuck-state regression family (same shape as FG_060).

## Goal

`pnpm --filter=@feel-good/mirror test:unit` exits 0 with all 153 tests passing, and the four FG_075 pending-navigation recovery tests in `desktop-workspace.test.tsx` execute against a properly-wrapped (or properly-mocked) `ProfileRouteDataProvider` so they actually exercise `WorkspaceInteractionPanel`'s code path.

## Scope

- Identify why `WorkspaceInteractionPanel` calls `useProfileRouteData()` and whether the test should provide a real `ProfileRouteDataProvider`, a mock context value, or a `vi.mock(...)` stub for the hook.
- Update `apps/mirror/app/[username]/_components/__tests__/desktop-workspace.test.tsx` so all 4 failing tests pass, preserving what each test asserts about the pending-navigation latch.
- Confirm the fix preserves FG_075 coverage — each test must still drive the code paths described in its name (timeout fallback, true→false mid-flight, in-flight guard, unmount cleanup).

## Out of Scope

- Changing `WorkspaceInteractionPanel`'s use of `useProfileRouteData()` itself.
- Changing `ProfileRouteDataProvider` or `useProfileRouteData` semantics.
- Other unit-test failures not in the FG_075 describe block (none currently exist; this is the only failing file).
- Reworking the FG_075 fix logic in `desktop-workspace.tsx`.

## Approach

Two viable options. Pick one and justify in the PR:

1. **Wrap with a real provider.** Locate `ProfileRouteDataProvider` (likely `apps/mirror/app/[username]/_providers/profile-route-data-context.tsx`) and wrap the `render(...)` call in each test (or via a shared `renderWithProviders` helper) with it, passing a minimal valid value matching the context shape. Best when `WorkspaceInteractionPanel` reads multiple fields from the context.

2. **Mock the hook module.** Add `vi.mock('@/app/[username]/_providers/profile-route-data-context', ...)` at the top of the test file returning a stub `useProfileRouteData` that yields the minimal shape `WorkspaceInteractionPanel` reads. Best when the test only needs DesktopWorkspace's pending-navigation behavior and the route-data context is incidental.

Verify which fields `WorkspaceInteractionPanel` actually destructures from `useProfileRouteData()` before choosing — if it's a small surface, mock; if it's the full context, wrap.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Read `apps/mirror/app/[username]/_components/workspace-panels.tsx` (around line 81) and confirm exactly which fields `WorkspaceInteractionPanel` reads from `useProfileRouteData()`.
2. Read `apps/mirror/app/[username]/_providers/profile-route-data-context.tsx` to confirm the context value shape and whether the provider takes a `value` prop or computes it internally.
3. Read `apps/mirror/app/[username]/_components/__tests__/desktop-workspace.test.tsx` end-to-end; identify the existing render helper (if any) and what other providers/mocks are already in place.
4. Pick approach 1 (provider wrap) or approach 2 (vi.mock); apply uniformly across all 4 failing tests in the FG_075 describe block (or via a shared helper if one exists).
5. Run `pnpm --filter=@feel-good/mirror test:unit` and confirm the 4 FG_075 tests now pass and total is `Tests 153 passed (153)`.
6. Run `pnpm --filter=@feel-good/mirror build && pnpm --filter=@feel-good/mirror lint` and confirm 0 errors.
7. Spot-check that the FG_075 assertions still meaningfully exercise the pending-navigation latch (timeout fallback fires, true→false clears the ref, double-invocation guard holds, unmount cleanup runs). If the fix is a hook mock, the test must still cause `WorkspaceInteractionPanel` to render; do not bypass it entirely.

## Constraints

- Do not change `desktop-workspace.tsx` or the FG_075 fix — this ticket is harness-only.
- Do not change `WorkspaceInteractionPanel` or `ProfileRouteDataProvider` source files; the bug is in the test setup.
- If using `vi.mock`, scope the mock to this test file only — do not add a global mock that would leak into other suites.
- The 4 test names must remain unchanged so FG_075 traceability stays intact.

## Resources

- Failing file: `apps/mirror/app/[username]/_components/__tests__/desktop-workspace.test.tsx`
- Hook source: `apps/mirror/app/[username]/_providers/profile-route-data-context.tsx:38`
- Consumer: `apps/mirror/app/[username]/_components/workspace-panels.tsx:81`
- Originating ticket: `workspace/tickets/completed/FG_075-p2-desktop-workspace-pending-nav-ref-stuck.md`
- Parent commit confirming pre-existence: `0780702e refactor(articles): extract ArticleEditorToolbar from editor shell`
- Convention: `.claude/rules/verification.md` (Tier 1 — types/utils; this is a test-harness change with a unit-test-only blast radius)
