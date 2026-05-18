---
id: FG_255
title: "getByUsername hides drafts from non-owners under the row cap"
date: 2026-05-18
type: chore
status: to-do
priority: p2
description: "The non-owner by_userId_and_status branch that fixes the FG_248 cap-versus-visibility interaction has no unit test, so reverting it to the unbounded by_userId path would silently regress and hide published posts behind old drafts."
dependencies: []
acceptance_criteria:
  - "packages/convex/convex/posts/__tests__/queries.test.ts has a test where a user has one draft and one published post and a non-owner getByUsername call returns only the published post"
  - "A test asserts the owner getByUsername call returns the draft as well"
  - "`pnpm --filter=@feel-good/convex test` passes for queries.test.ts (pre-existing unrelated failures in other convex test files are out of scope)"
  - "Forcing the non-owner branch to use the by_userId index makes the new non-owner test fail (verified by a temporary local change during development)"
---

# getByUsername hides drafts from non-owners under the row cap

## Context

This branch reshaped `packages/convex/convex/posts/queries.ts` `getByUsername`: owners read `by_userId` capped at 100; non-owners read `by_userId_and_status` (`status = "published"`) capped at 100. The non-owner status-index branch is the FG_248 fix — capping `by_userId` first then filtering visibility would let old drafts consume cap slots and hide later published posts from the public list.

Found in code review (tests reviewer, confidence 0.93). `packages/convex/convex/posts/__tests__/queries.test.ts` was not modified; its only `getByUsername` test exercises the authenticated owner path. Reverting the non-owner branch to `by_userId` + post-filter would re-introduce the FG_248 bug with no failing test.

## Scope

- Add convex-test coverage proving the non-owner branch returns published-only and the owner branch includes drafts.

## Approach

In `queries.test.ts`, seed an owner with one `draft` and one `published` post. Call `getByUsername` without signing in (so `isOwner` is false) and assert only the published post is returned; call it as the authenticated owner and assert the draft is present.

## Implementation Steps

1. Read `packages/convex/convex/posts/__tests__/queries.test.ts` (existing getByUsername test + helpers) and the branch in `posts/queries.ts`.
2. Add a non-owner test (no sign-in) asserting published-only output.
3. Add an owner test asserting drafts are included.
4. Run `pnpm --filter=@feel-good/convex test`.

## Constraints

- Assert on visibility/cap behavior (which posts appear), independent of the post `body` shape, so the test stays valid if FG_258 changes the list return shape.
