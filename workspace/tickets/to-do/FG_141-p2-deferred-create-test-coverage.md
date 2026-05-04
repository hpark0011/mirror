---
id: FG_141
title: "Deferred-create test proves no DB row across the metadata-editing lifecycle"
date: 2026-05-05
type: fix
status: to-do
priority: p2
description: "The 'does NOT call create on mount' test only checks the mount instant, leaving the no-DB-row-before-Save invariant unproven for the full editing flow."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "`apps/mirror/features/articles/hooks/__tests__/use-new-article-form.test.ts` includes a test case that calls `setTitle`, `setSlug`, and `setCategory` (via act) after `renderHook` and asserts `mockCreate` was NOT called."
  - "The test fails (red) when the hook is mutated to call `create` on `setTitle`."
  - "`pnpm --filter=@feel-good/mirror test:unit -- use-new-article-form` passes."
owner_agent: "test engineer (Vitest)"
---

# Deferred-create test proves no DB row across the metadata-editing lifecycle

## Context

Surfaced by the PR #34 code review (`code-review-pr34` batch); also raised by CodeRabbit (PR thread r3180086696). The test at `apps/mirror/features/articles/hooks/__tests__/use-new-article-form.test.ts:75-78` only asserts that `create` is not called immediately after `renderHook`. A regression that fires `create` on `setTitle` would pass this test trivially.

The deferred-create contract is the most distinctive promise of the new-article flow — "abandoning the page leaves no trace in the DB." It deserves a full-lifecycle proof.

**Risk:** silent regression — a future change that adds an "auto-save" or any premature `create` call could land without a failing test.

## Goal

The deferred-create test proves `create` is not called through any sequence of metadata setter calls before `save()` is invoked.

## Scope

- Extend the existing test to call setters before asserting.
- Optionally add a second test that proves `create` IS called exactly once after `save()`.

## Out of Scope

- Changing the hook's behavior.
- Adding e2e coverage for this invariant (already partially covered by the editor e2e spec).

## Approach

Wrap setter calls in `act(...)`, then assert `mockCreate.not.toHaveBeenCalled()`.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. In `apps/mirror/features/articles/hooks/__tests__/use-new-article-form.test.ts`, expand the "does NOT call create on mount" test (line 75) to:
   ```ts
   const { result } = renderHook(() => useNewArticleForm({ username: 'test' }));
   await act(async () => {
     result.current.setTitle('foo');
     result.current.setSlug('foo-bar');
     result.current.setCategory('cat');
   });
   expect(mockCreate).not.toHaveBeenCalled();
   ```
2. Confirm the existing "save success" test still passes — it covers the positive path.
3. Run `pnpm --filter=@feel-good/mirror test:unit -- use-new-article-form`.

## Constraints

- Do not break the existing test cases in this file.
- Use `act()` to avoid React warnings.

## Resources

- PR #34: https://github.com/hpark0011/mirror/pull/34
- CodeRabbit thread: https://github.com/hpark0011/mirror/pull/34#discussion_r3180086696
