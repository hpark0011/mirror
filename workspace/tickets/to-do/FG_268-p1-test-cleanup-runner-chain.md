---
id: FG_268
title: "Legacy cleanup runner deletes every configuration thread safely"
date: 2026-08-03
type: improvement
status: to-do
priority: p1
description: "Exercise the successful destructive cleanup chain so target selection, component deletion, local deletion, rescheduling, and completion are proven."
dependencies: []
parent_plan_id: workspace/plans/2026-08-03-remove-clone-settings-pages-plan.md
acceptance_criteria:
  - "A test seeds multiple configuration rows plus clone-mode and missing-mode public rows."
  - "Running cleanupNext through scheduled completion deletes exactly the configuration component threads and local rows."
  - "Clone-mode and missing-mode rows and threads remain unchanged, and a terminal rerun reports complete without deletion."
  - "The existing component-deletion failure case continues to retain its local row."
  - "pnpm --filter=@feel-good/convex test exits 0."
owner_agent: "Convex Migration Test Developer"
---

# Legacy cleanup runner deletes every configuration thread safely

## Context

`packages/convex/convex/chat/legacyConfigurationCleanup.ts:58-95` performs a
destructive component-thread deletion, local-row deletion, and recursive
schedule. Current tests invoke `cleanupNext` only when the mocked component
deletion throws; successful selection, deletion, rescheduling, and the terminal
branch are untested. Calling `deleteLocalRow` directly does not prove the
runner targets only configuration rows or progresses beyond its first item.

## Goal

The cleanup runner is proven to delete all and only legacy configuration
threads and rows, remain retryable on failure, and terminate idempotently.

## Scope

- Test indexed target selection with mixed conversation modes.
- Test successful component-first deletion and recursive scheduling.
- Test terminal completion and repeat execution.

## Out of Scope

- Running cleanup against any live Convex deployment.
- Testing the separate user-field and clone-mode migrations.

## Approach

Extend the mocked-agent Convex harness with multiple rows and drain scheduled
functions until completion. Record deleted thread IDs and inspect the local
database after every stage to verify ordering and isolation.

- **Effort:** Medium
- **Risk:** Low

## Implementation Steps

1. Extend `legacyConfigurationCleanup.test.ts` to seed two configuration rows, one clone row, and one missing-mode row.
2. Run `cleanupNext` successfully and drain its scheduled continuation work.
3. Assert exact component thread IDs, exact deleted local rows, preserved public rows, and terminal return values.
4. Rerun cleanup to prove idempotency while preserving the existing failure-path assertion.
5. Run `pnpm --filter=@feel-good/convex test`.

## Constraints

- Component thread deletion must be observed before the matching local row disappears.
- Tests must not call a live component or deployment.

## Resources

- `workspace/plans/2026-08-03-remove-clone-settings-pages-plan.md`
- `packages/convex/convex/chat/legacyConfigurationCleanup.ts`
