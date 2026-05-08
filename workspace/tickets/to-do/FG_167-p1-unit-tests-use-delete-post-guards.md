---
id: FG_167
title: "useDeletePost guards (double-submit, escape-block, error path) are unit tested"
date: 2026-05-08
type: improvement
status: to-do
priority: p1
description: "The new useDeletePost hook at apps/mirror/features/posts/hooks/use-delete-post.ts introduces three conditional branches that protect destructive behavior — the double-submit isSubmittingRef guard at line 38, the escape/outside-click block at line 65, and the catch arm at lines 47-54 that keeps the dialog open after a mutation rejection. None of these have a unit test. Inverting any of the predicates would still pass the existing suite. Add a Vitest spec that drives the hook with a mocked mutation and asserts each guard behaves as designed."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "test -f apps/mirror/features/posts/__tests__/use-delete-post.test.ts"
  - "grep -nE 'isSubmittingRef|removePosts.*toHaveBeenCalledTimes' apps/mirror/features/posts/__tests__/use-delete-post.test.ts returns at least 1 match (double-submit assertion)"
  - "grep -nE 'handleOpenChange\\(false\\)|escape|stays open' apps/mirror/features/posts/__tests__/use-delete-post.test.ts returns at least 1 match (escape-block assertion)"
  - "grep -nE 'showToast.*error|type.*error' apps/mirror/features/posts/__tests__/use-delete-post.test.ts returns at least 1 match (error-path assertion)"
  - "pnpm --filter=@feel-good/mirror test:unit -- use-delete-post passes"
  - "pnpm build --filter=@feel-good/mirror succeeds"
  - "pnpm lint --filter=@feel-good/mirror succeeds"
owner_agent: "Vitest unit-test specialist"
---

# useDeletePost guards (double-submit, escape-block, error path) are unit tested

## Context

Code review of `feature-post-delete-button` (review-code Phase 6 finding `missing-unit-test-use-delete-post-guards`, P1) flagged that the new hook introduced three load-bearing branches and zero unit tests:

- `apps/mirror/features/posts/hooks/use-delete-post.ts:38` — `if (isSubmittingRef.current) return;` (rejects double-confirm during in-flight mutation).
- `apps/mirror/features/posts/hooks/use-delete-post.ts:65` — `if (!open && isSubmittingRef.current) return;` (rejects Escape / outside-click closes during pending; the inline comment in the file paraphrases this as "Dialog stays open so the user can retry").
- `apps/mirror/features/posts/hooks/use-delete-post.ts:47-54` — catch arm: `showToast({ type: "error", ... })` and the dialog stays open. The success path (43-46) also matters as the negative control.

If a future refactor inverts any of these predicates the build still passes, lint still passes, and there is no regression signal. The sibling `usePublishToggle` shares the same shape and likewise has no hook-level test (`apps/mirror/features/posts/__tests__/publish-toggle.test.tsx` covers the component, not the guards). This ticket targets the hook; the component-level happy path is covered by FG_166's e2e.

## Goal

A new Vitest spec at `apps/mirror/features/posts/__tests__/use-delete-post.test.ts` that drives `useDeletePost` with a mocked Convex mutation and asserts each guard. After this ticket, inverting `isSubmittingRef.current` in either guard, or removing the catch arm, turns the suite red.

## Scope

- Add the new test file. Use `@testing-library/react` `renderHook` + `act` (the same combination used by the codebase's other hook tests) to drive the hook.
- Mock `useMutation`, `useRouter`, `showToast`, and `useChatSearchParams` so the hook's external dependencies are deterministic.
- Cover three behaviors: double-submit rejection, escape-block during pending, error-path keeps dialog open with toast.
- One assertion bundle per behavior — keep tests granular so a failure points to a specific guard.

## Out of Scope

- Adding tests for `usePublishToggle` (sibling has the same guard shape; that's a separate ticket if the team wants parity).
- Adding a happy-path test that asserts navigation — `router.replace` is mocked; the e2e in FG_166 covers the live navigation.
- Refactoring the hook to make it more testable — current shape is sufficient.
- Changing the production code under `apps/mirror/features/posts/`.

## Approach

`renderHook` + a `useMutation` mock that returns a controllable Promise (resolve/reject via `deferred()`). For each test:

1. Render the hook with stub args.
2. Trigger the action (`result.current.handleConfirm()` or `result.current.handleOpenChange(false)`).
3. Assert pre-resolution state.
4. Resolve or reject the deferred mutation.
5. Assert post-resolution state.

Module mocks via `vi.mock(...)`:

- `convex/react` → `useMutation` returns the controllable spy.
- `next/navigation` → `useRouter` returns `{ replace: vi.fn() }`.
- `@feel-good/ui/components/toast` → `showToast` is a spy.
- `@/hooks/use-chat-search-params` → returns `{ buildChatAwareHref: (s: string) => s }`.

Reference patterns in the codebase: `apps/mirror/features/posts/__tests__/publish-toggle.test.tsx`, `apps/mirror/features/posts/__tests__/use-create-post-from-file.test.ts`. Both use `vi.mock` and `renderHook`.

- **Effort:** Small
- **Risk:** Low — pure test addition; no production code changes.

## Implementation Steps

1. Create `apps/mirror/features/posts/__tests__/use-delete-post.test.ts`. Set up module mocks for `convex/react`, `next/navigation`, `@feel-good/ui/components/toast`, and `@/hooks/use-chat-search-params`.
2. Test 1 — double-submit guard: render the hook, kick off `handleConfirm()` twice in the same `act` synchronously, then resolve the deferred mutation; assert `removePosts` was called exactly once and `showToast` was called exactly once with the success title.
3. Test 2 — escape-block during pending: render, call `handleConfirm()` (don't resolve), then call `handleOpenChange(false)`; assert `result.current.dialogOpen === true`. Resolve, assert `dialogOpen === false`.
4. Test 3 — error-keeps-dialog-open: render, open the dialog (`handleOpenChange(true)`), call `handleConfirm()` and reject the mutation with `new Error("Server says no")`; assert `result.current.dialogOpen === true`, `result.current.isPending === false`, and `showToast` was called with `{ type: "error", title: "Server says no" }`.
5. Optional Test 4 — non-Error rejection falls back to "Something went wrong. Try again.": reject with a string and assert the fallback toast title.
6. Run `pnpm --filter=@feel-good/mirror test:unit -- use-delete-post` and confirm green.
7. Run `pnpm build --filter=@feel-good/mirror` and `pnpm lint --filter=@feel-good/mirror`.

## Constraints

- Pure test addition — do not edit `apps/mirror/features/posts/hooks/use-delete-post.ts`.
- Must use the codebase's existing test conventions: `renderHook` from `@testing-library/react`, `vi.mock` for modules, deferred promises for controlling mutation timing.
- Mock the **Promise** the mutation returns; do not stub `removePosts` to resolve synchronously, otherwise the in-flight branch coverage is bypassed.
- All asserted strings (toast titles, error messages) must match the literals in `use-delete-post.ts:42-54` byte-for-byte; if the hook copy changes, update the test.

## Resources

- Code review report (this branch) — Finding #3, P1 High — `missing-unit-test-use-delete-post-guards`.
- `apps/mirror/features/posts/hooks/use-delete-post.ts:37-67` — the unit under test.
- `apps/mirror/features/posts/__tests__/publish-toggle.test.tsx` — convention reference for `vi.mock` + `renderHook`.
- `apps/mirror/features/posts/__tests__/use-create-post-from-file.test.ts` — convention reference for hook-level testing of async behavior.
- `apps/mirror/vitest.config.ts` — Vitest config picked up by `pnpm test:unit`.
