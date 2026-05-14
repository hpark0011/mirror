---
id: FG_215
title: "applyContentPatch newSlug rename + collision is tested"
date: 2026-05-14
type: improvement
status: to-do
priority: p2
description: "The `newSlug` field on the update operation is part of the agent's tool schema but has zero test coverage. The writeHelper's slug-collision guard for renames at `updatePostRow`/`updateArticleRow` could regress, allowing the agent to create duplicate slug rows or routing the owner to a stale slug after a successful rename."
dependencies: []
parent_plan_id: workspace/plans/2026-05-14-config-agent-content-authoring-plan.md
acceptance_criteria:
  - "A test seeds a post, calls `applyContentPatch` with `{ action: 'update', newSlug: 'renamed-slug' }`, asserts the DB row's slug field equals the normalized new slug, and asserts the result's `lastTouched.slug` matches."
  - "A second test seeds two posts and attempts to rename one to the other's slug, expecting rejection matching `/already exists/`."
  - "After rejection, `posts` rows under the owner are unchanged (transaction rolled back)."
  - "`pnpm --filter=@feel-good/convex test` exits 0."
owner_agent: "Convex chat tests writer"
---

# applyContentPatch newSlug rename + collision is tested

## Context

Code review on branch `hpark0011/explain-profile-config-agent` (P2, tests lane). The `contentPatchOperationValidator` in `chat/toolMutations.ts:471` declares `newSlug: v.optional(v.string())`, which flows through to `updatePostForUserBySlug`'s `args.slug` parameter (the new slug). The collision check at `posts/writeHelpers.ts:254-264` and `articles/writeHelpers.ts:259-270` could be removed and no existing test would catch it.

## Goal

Both halves of the rename contract — success path normalizes the slug; collision path throws — are pinned by tests.

## Scope

- Test 1: rename a post to a fresh slug; assert DB and result slug match.
- Test 2: rename a post into a collision; assert throw matching `/already exists/`.

## Out of Scope

- Article rename tests (same code path; one kind is sufficient to pin the guard — but worth a sentence in the test description noting the parity).
- Testing slug normalization edge cases (covered in `content/__tests__/slug.test.ts`).

## Approach

Standard convex-test mutation pattern. After rejection, query the owner's post rows to confirm no partial writes (atomicity is already tested elsewhere but worth re-asserting here in the rename context).

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. In `packages/convex/convex/chat/__tests__/tools.test.ts` `applyContentPatch` describe, add a test "renames a post via newSlug and reports the persisted slug".
2. Seed a post with slug `original`, call `applyContentPatch` with `{ action: 'update', kind: 'posts', slug: 'original', newSlug: 'Renamed Slug' }`, fetch the row, assert `slug === 'renamed-slug'` and `result.lastTouched.slug === 'renamed-slug'`.
3. Add a second test "rejects newSlug collisions against existing rows".
4. Seed two posts (`first` and `second`), call `applyContentPatch` with `{ action: 'update', slug: 'first', newSlug: 'second' }`, expect `.rejects.toThrow(/already exists/)`.
5. After rejection, query the owner's posts and assert no slug changed.
6. Run `pnpm --filter=@feel-good/convex test`.

## Constraints

- Test-only change.
- Use the existing `insertOwner` helper for owner seeding.

## Resources

- `packages/convex/convex/posts/writeHelpers.ts:254-264` (collision guard).
- PLAN_013 coverage requirements: "applyContentPatch rejects slug collisions."
