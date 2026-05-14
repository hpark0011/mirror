---
id: FG_208
title: "applyContentPatch stops navigating on missed-slug deletes"
date: 2026-05-14
type: fix
status: to-do
priority: p1
description: "`applyContentPatch` sets `lastDeleted` on every delete operation regardless of whether a row was actually removed, so the watcher dispatches `navigateToProfileSection` even when the agent asked to delete a slug that does not exist. The in-code comment in the watcher claims 'no rows touched → no-op' but that branch is never reached because `lastDeleted` is always non-null after a delete op."
dependencies: []
parent_plan_id: workspace/plans/2026-05-14-config-agent-content-authoring-plan.md
acceptance_criteria:
  - "After fix, running the convex test suite passes a new case asserting a delete-only patch where every op missed leaves `lastDeleted === null` in the mutation return."
  - "Existing test `delete returns deleted: true for an owned row and false for a miss` (packages/convex/convex/chat/__tests__/tools.test.ts) still passes."
  - "`grep -n 'lastDeleted = {' packages/convex/convex/chat/toolMutations.ts` shows the assignment is wrapped in `if (deleteResult.deleted)`."
  - "`pnpm --filter=@feel-good/convex test` exits 0."
owner_agent: "Convex chat tools fixer"
---

# applyContentPatch stops navigating on missed-slug deletes

## Context

Code review on branch `hpark0011/explain-profile-config-agent` flagged this as a P1 correctness bug introduced by PLAN_013. In `packages/convex/convex/chat/toolMutations.ts:720-738`, the delete branch of `applyContentPatch` unconditionally sets `lastDeleted` even when `deleteResult.deleted === false`. The watcher at `apps/mirror/features/chat/hooks/use-agent-intent-watcher.ts:469-489` reads `lastDeleted` first; the watcher author's intent (per the comment "no rows touched — shouldn't happen, but ... no-op") was that a missed delete should not navigate. The bug routes the owner to the section list even when the agent supplied a stale slug, producing phantom navigation with no state change.

## Goal

A `applyContentPatch` call whose only delete operations all return `deleted: false` returns `lastDeleted: null`, so the watcher leaves the owner on their current page.

## Scope

- Wrap the `lastDeleted = { ... }` assignment in `if (deleteResult.deleted) { ... }` inside the delete branch.
- Add a Convex test for a delete-only patch where every operation misses, asserting `lastDeleted === null`.

## Out of Scope

- Changing the delete return shape (`{ deleted, slug, href }` stays the same — clients read `results[].deleted`).
- Watcher behavior change — the watcher comment is already correct; we are fixing the server to match it.

## Approach

Guard the `lastDeleted` assignment on `deleteResult.deleted === true`. Convex auto-rolls-back the transaction on any throw, and `lastTouched` semantics remain unchanged.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Edit `packages/convex/convex/chat/toolMutations.ts` lines 733-738 — wrap `lastDeleted = { kind: op.kind, slug: deleteResult.slug, href: sectionHref };` in `if (deleteResult.deleted) { ... }`.
2. Add a test case in `packages/convex/convex/chat/__tests__/tools.test.ts` (within the `applyContentPatch` describe): seed no rows, call `applyContentPatch` with two delete operations on non-existent slugs, assert `result.lastDeleted === null` and `result.applied.deleted === 0`.
3. Run `pnpm --filter=@feel-good/convex test` and confirm green.
4. Run `pnpm --filter=@feel-good/convex check-types` and confirm green.

## Constraints

- Do not change `results[]` shape — only `lastDeleted` becomes null on all-miss.
- Do not touch the watcher; the routing rule there is already correct.

## Resources

- Code review report on this branch (in-conversation, "Code Review Results").
- Watcher comment: `apps/mirror/features/chat/hooks/use-agent-intent-watcher.ts:469`.
