---
id: FG_151
title: "Edit-form cancel navigates to the original slug (regression test)"
date: 2026-05-05
type: fix
status: to-do
priority: p3
description: "useEditArticleForm.cancel uses initial.slug, but no test asserts this — a refactor that switches to the editable slug state would go undetected."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "A unit test for `useEditArticleForm` calls `cancel()` and asserts `mockRouter.push` was called with a URL containing `initial.slug`, not the form-state slug."
  - "Mutating the form's `slug` state before calling `cancel()` and verifying it does NOT affect the navigation target."
  - "`pnpm --filter=@feel-good/mirror test:unit` passes."
owner_agent: "test engineer (Vitest)"
---

# Edit-form cancel navigates to the original slug (regression test)

## Context

Surfaced by the PR #34 code review (`code-review-pr34` batch; tests reviewer). `apps/mirror/features/articles/hooks/use-edit-article-form.tsx:165-167` defines `cancel = () => router.push(\`/@${username}/articles/${initial.slug}\`)`. The behavior is correct — Cancel goes back to the article's original slug URL, not the potentially-edited form slug — but no test asserts it. There is no `useEditArticleForm` test file at all.

**Risk (low):** silent regression — a future refactor that switches `cancel` to use `slug` (the form state) instead of `initial.slug` would produce broken navigation when the user has edited the slug field but not saved.

## Goal

A test guards the cancel-uses-initial-slug invariant.

## Scope

- Create `apps/mirror/features/articles/hooks/__tests__/use-edit-article-form.test.ts` if it doesn't exist.
- Add a test for `cancel()`.

## Out of Scope

- Other behavior tests for `useEditArticleForm` (those can come in separate tickets if needed).
- E2E coverage.

## Approach

Mock the router, render the hook with a known `initial`, mutate `slug` via `setSlug`, call `cancel`, assert the router push was called with the original slug.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Create `apps/mirror/features/articles/hooks/__tests__/use-edit-article-form.test.ts` (or extend if a sibling test file exists).
2. Mock `useRouter` from `next/navigation`.
3. Render the hook with `initial.slug = "original-slug"`.
4. Call `result.current.setSlug("edited-slug")`.
5. Call `result.current.cancel()`.
6. Assert `mockPush` was called with a URL containing `original-slug`, not `edited-slug`.

## Constraints

- Do not change the hook's behavior — this is test-only.

## Resources

- PR #34: https://github.com/hpark0011/mirror/pull/34
