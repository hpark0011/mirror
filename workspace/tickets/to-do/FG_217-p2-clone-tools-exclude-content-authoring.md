---
id: FG_217
title: "Public clone tools surface excludes the new content authoring tools"
date: 2026-05-14
type: improvement
status: to-do
priority: p2
description: "The `inputSchema invariants` describe block pins the public `buildCloneTools` tool list shape but does not assert what is absent. If a future refactor accidentally imports `applyContentPatch`, `getProfileContentLibrary`, or `getProfileContentForEdit` into `buildCloneTools`, public visitor sessions could call content-mutating operations against the profile owner's content and the test suite would not catch it."
dependencies: []
parent_plan_id: workspace/plans/2026-05-14-config-agent-content-authoring-plan.md
acceptance_criteria:
  - "A test asserts `Object.keys(buildCloneTools(fakeOwner, ...))` does NOT include `applyContentPatch`, `getProfileContentLibrary`, or `getProfileContentForEdit`."
  - "`pnpm --filter=@feel-good/convex test` exits 0."
  - "Adding `applyContentPatch` to the return of `buildCloneTools` in `chat/tools.ts` causes the new test to fail."
owner_agent: "Convex chat tests writer"
---

# Public clone tools surface excludes the new content authoring tools

## Context

Code review on branch `hpark0011/explain-profile-config-agent` (P2, tests lane). PLAN_013 explicitly states "the public clone mode remains unchanged." The existing `inputSchema invariants` block at `packages/convex/convex/chat/__tests__/tools.test.ts:1157-1422` covers tools that already exist but contains no negative assertion. The `rateLimits.test.ts:904-913` block pins the configuration tools list exactly, but the parallel pin for clone tools is missing.

## Goal

A regression test catches accidental leakage of any of the three new content-authoring tools into the visitor-facing `buildCloneTools` surface.

## Scope

- Add a single test in the `inputSchema invariants` describe block that calls `buildCloneTools(...)` and asserts `Object.keys(tools)` does not contain the three new tool names.

## Out of Scope

- Pinning the exact clone tools list (already done by the existing `inputSchema invariants` describe).
- Asserting absence of arbitrary unrelated keys (only the three new ones matter).

## Approach

Mirror the `rateLimits.test.ts:904` exact-list pattern but use `not.toContain` on the three new keys.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. In `packages/convex/convex/chat/__tests__/tools.test.ts` `inputSchema invariants` describe, add a test "buildCloneTools does not expose configuration content authoring tools to visitors".
2. Call `const tools = buildCloneTools(owner, ...)` with whatever fixture the existing tests use.
3. For each of `'applyContentPatch'`, `'getProfileContentLibrary'`, `'getProfileContentForEdit'`: `expect(Object.keys(tools)).not.toContain(name)`.
4. Run `pnpm --filter=@feel-good/convex test`.

## Constraints

- Test-only change.
- Don't tighten this to an exact key list — that's `rateLimits.test.ts`'s job; this test exists specifically for the negative direction.

## Resources

- `packages/convex/convex/chat/__tests__/rateLimits.test.ts:904-913` (the configuration-tools exact-list pattern).
- `.claude/rules/agent-parity.md` § public clone surface.
