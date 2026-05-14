---
id: FG_212
title: "applyContentPatch update from published to draft cleans embeddings"
date: 2026-05-14
type: improvement
status: to-do
priority: p1
description: "The update test in `applyContentPatch` starts with a draft post and updates without flipping status. No test seeds a published row and then calls `applyContentPatch` with `status: 'draft'` to assert that `internal.embeddings.mutations.deleteBySource` is scheduled. The `else if (args.status === 'draft')` cleanup branch in `updatePostRow`/`updateArticleRow` could regress, leaving stale embeddings in clone-agent RAG retrieval for content the owner has unpublished."
dependencies: []
parent_plan_id: workspace/plans/2026-05-14-config-agent-content-authoring-plan.md
acceptance_criteria:
  - "A test in the `applyContentPatch` describe block seeds a `status: 'published'` post, calls `applyContentPatch` with `{ action: 'update', status: 'draft' }`, and asserts a scheduled `internal.embeddings.mutations.deleteBySource` job exists for that post."
  - "A parallel test exercises articles."
  - "`pnpm --filter=@feel-good/convex test` exits 0."
  - "Removing the `else if (args.status === 'draft')` branch from either writeHelper causes the new tests to fail."
owner_agent: "Convex chat tests writer"
---

# applyContentPatch update from published to draft cleans embeddings

## Context

Code review on branch `hpark0011/explain-profile-config-agent` (P1, tests lane). PLAN_013 coverage explicitly lists draft/delete embedding cleanup. The relevant production branches live at `packages/convex/convex/posts/writeHelpers.ts:432-437` and `packages/convex/convex/articles/writeHelpers.ts:442-447`. The existing update test (`tools.test.ts:2915-2961`) keeps status as `'draft'` throughout, so the publish→draft cleanup branch has zero coverage.

## Goal

The published→draft `deleteBySource` cleanup branch in both writeHelpers is pinned by tests reachable through `applyContentPatch`.

## Scope

- Add a test that seeds a published post, calls `applyContentPatch` update with `status: "draft"`, and asserts a `deleteBySource` job is scheduled for that sourceId.
- Add the parallel test for articles.

## Out of Scope

- Asserting that the embedding rows are actually removed (that is the embeddings action's contract and is covered in its own tests).
- Testing publish flipping (covered by FG_211 in this batch).

## Approach

Same harness pattern as FG_211: introspect the scheduler after the mutation. Seed via `t.run(...)` insert with `status: 'published'` and a `publishedAt` timestamp; call the mutation; assert a scheduled `deleteBySource` job exists.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. In `packages/convex/convex/chat/__tests__/tools.test.ts` `applyContentPatch` describe, add `"schedules embedding cleanup when a published post flips to draft"`: seed a published post, call `applyContentPatch` with `{ action: 'update', kind: 'posts', slug, status: 'draft' }`, assert scheduled `deleteBySource` job for that `sourceId`.
2. Duplicate for articles.
3. Run `pnpm --filter=@feel-good/convex test`.

## Constraints

- Match the scheduling-assertion pattern established in FG_211 (and pre-existing codebase patterns).
- Do not execute the real embeddings action.

## Resources

- `workspace/lessons.md` § "Convex tests should isolate scheduled embedding side effects".
- PLAN_013 coverage requirements.
