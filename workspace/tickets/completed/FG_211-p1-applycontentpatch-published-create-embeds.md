---
id: FG_211
title: "applyContentPatch schedules embedding generation on published create"
date: 2026-05-14
type: improvement
status: completed
priority: p1
description: "The `applyContentPatch` test suite has eight cases but every create uses `status: 'draft'` (the implicit default). The `if (args.status === 'published')` branch in `createPostForUser`/`createArticleForUser` that schedules `internal.embeddings.actions.generateEmbedding` is therefore unprotected — it could be removed and all tests still pass. Agent-authored published content would silently never reach the clone-agent RAG retrieval."
dependencies: []
parent_plan_id: workspace/plans/2026-05-14-config-agent-content-authoring-plan.md
acceptance_criteria:
  - "A test in the `applyContentPatch` describe block creates a post with `status: 'published'` and asserts that a scheduled function for `internal.embeddings.actions.generateEmbedding` exists for the newly created post's sourceId."
  - "A parallel test exercises the same path for articles."
  - "`pnpm --filter=@feel-good/convex test` exits 0."
  - "Removing the `if (args.status === 'published') { await ctx.scheduler.runAfter(...) }` branch from either writeHelper causes the new tests to fail."
owner_agent: "Convex chat tests writer"
---

# applyContentPatch schedules embedding generation on published create

## Context

Code review on branch `hpark0011/explain-profile-config-agent` (P1, tests lane). PLAN_013's coverage requirements explicitly list "Published create/update schedules embedding generation; draft/delete paths do the existing embedding cleanup." The current test suite at `packages/convex/convex/chat/__tests__/tools.test.ts:2840-3124` covers atomicity, body validation, slug collision, op cap, and delete miss — but never `status: "published"`. The scheduling branch lives at `packages/convex/convex/posts/writeHelpers.ts:165-171` (and the articles mirror) and is currently uncovered. `workspace/lessons.md` line 133-144 also pins this: embedding side-effects must be isolated and tested.

## Goal

The published-create embedding-schedule branch in both writeHelpers is pinned by tests reachable through `applyContentPatch`.

## Scope

- Add a test that calls `applyContentPatch` with a single `{ action: "create", status: "published", kind: "posts", ... }` operation and asserts a scheduled `generateEmbedding` job exists for the created row.
- Add the parallel test for `kind: "articles"`.

## Out of Scope

- Mocking the embedding action's behavior — only assert scheduling, not execution.
- Testing the embeddings action itself (already covered in `embeddings/__tests__/`).

## Approach

Use the existing `convex-test` harness's introspection of `_scheduled_functions` (per existing patterns in the codebase) or a scheduler spy. After the mutation, query scheduled functions and assert a job exists with `function: "embeddings/actions:generateEmbedding"` and `args.sourceId === createdPostId`.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Look at how existing tests in the codebase verify scheduled embeddings (search for `generateEmbedding` references in `__tests__/` to find the established assertion pattern).
2. In `packages/convex/convex/chat/__tests__/tools.test.ts` `applyContentPatch` describe, add `"schedules embedding generation on published post create"`: seed an owner, call `applyContentPatch` with `status: "published"`, query the persisted row by slug to get `_id`, then assert a scheduled `generateEmbedding` job exists for that sourceId.
3. Duplicate the test for `kind: "articles"`.
4. Run `pnpm --filter=@feel-good/convex test`.

## Constraints

- Use whatever harness shape the codebase already uses for scheduled-function assertions — do not introduce a new pattern.
- Don't add lessons.md-violating real-embedding generation; just assert the schedule.

## Resources

- `workspace/lessons.md` § "Convex tests should isolate scheduled embedding side effects".
- PLAN_013 coverage requirements: `workspace/plans/2026-05-14-config-agent-content-authoring-plan.md`.
