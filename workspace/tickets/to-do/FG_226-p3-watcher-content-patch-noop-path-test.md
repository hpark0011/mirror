---
id: FG_226
title: "Watcher applyContentPatch no-op output path is covered by a test"
date: 2026-05-14
type: improvement
status: to-do
priority: p3
description: "The watcher's `APPLY_CONTENT_PATCH_TYPE` handler has three branches: navigate-to-content, navigate-to-section, and an implicit no-op when both `lastTouched` and `lastDeleted` are `null`. The existing 'malformed' test exercises a structurally invalid output; no test exercises a structurally valid output where neither field is populated."
dependencies: []
parent_plan_id: workspace/plans/2026-05-14-config-agent-content-authoring-plan.md
acceptance_criteria:
  - "A test in `use-agent-intent-watcher.test.ts` passes a valid `ContentPatchOutput` with `lastTouched: null`, `lastDeleted: null`, and `applied: { created: 0, updated: 0, deleted: 0 }`."
  - "The test asserts neither `navigateToContentMock` nor `navigateToProfileSectionMock` is called."
  - "`pnpm --filter=@feel-good/mirror test:unit` exits 0."
owner_agent: "Mirror chat watcher test writer"
---

# Watcher applyContentPatch no-op output path is covered by a test

## Context

Code review on branch `hpark0011/explain-profile-config-agent` (P3, tests lane). The watcher branch at `apps/mirror/features/chat/hooks/use-agent-intent-watcher.ts:469-489` short-circuits on `lastTouched`, then `lastDeleted`, then implicitly no-ops. After FG_208 lands (`lastDeleted` is gated by `deleteResult.deleted`), the all-null path becomes a real, reachable state for delete-only patches where every slug missed. This ticket adds the test to pin that "do nothing" is the intended behavior.

## Goal

The "valid output, no navigation" path is locked in by a regression test.

## Scope

- Add one test case to `use-agent-intent-watcher.test.ts`.

## Out of Scope

- Changing the watcher's no-op behavior (the no-op IS the correct response to all-null).
- Adding the same case to other tool types (each tool's no-op semantics differ).

## Approach

Mirror the existing `applyContentPatch` tests; pass a valid output shape where both `lastTouched` and `lastDeleted` are `null`.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Open `apps/mirror/features/chat/hooks/__tests__/use-agent-intent-watcher.test.ts`.
2. Add a test "leaves the user in place when applyContentPatch reports no rows touched".
3. Pass a `tool-applyContentPatch` output with `results: []`, `applied: { created: 0, updated: 0, deleted: 0 }`, `lastTouched: null`, `lastDeleted: null`.
4. Assert `navigateToContentMock` and `navigateToProfileSectionMock` are both not called.
5. Run `pnpm --filter=@feel-good/mirror test:unit`.

## Constraints

- Test-only change.
- Coordinate with FG_208 — this test is meaningful only after `lastDeleted` is guarded.

## Resources

- Watcher: `apps/mirror/features/chat/hooks/use-agent-intent-watcher.ts:458-490`.
- Related: FG_208 (the gating fix that makes this state reachable).
