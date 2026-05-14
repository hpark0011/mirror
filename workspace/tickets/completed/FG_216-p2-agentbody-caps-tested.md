---
id: FG_216
title: "agentBody size caps are enforced by tests"
date: 2026-05-14
type: improvement
status: completed
priority: p2
description: "`agentBody.ts` defines three numeric caps (`MAX_BLOCKS_PER_BODY = 200`, `MAX_TEXT_LENGTH_PER_BLOCK = 4000`, `MAX_BULLET_ITEMS = 50`) and throws `AgentBodyError` on overflow, but `agentBody.test.ts` has no test that crosses any threshold. All three guards could be silently removed and the agent could supply an unbounded body."
dependencies: []
parent_plan_id: workspace/plans/2026-05-14-config-agent-content-authoring-plan.md
acceptance_criteria:
  - "`agentBody.test.ts` includes a test passing 201 paragraph blocks and expecting `AgentBodyError`."
  - "`agentBody.test.ts` includes a test passing a paragraph with `text.length === 4001` and expecting `AgentBodyError`."
  - "`agentBody.test.ts` includes a test passing a bulletList with 51 items and expecting `AgentBodyError`."
  - "`pnpm --filter=@feel-good/convex test` exits 0."
  - "Removing any of the three `if (...> MAX_*) { throw ... }` guards in `agentBody.ts` causes the corresponding new test to fail."
owner_agent: "Convex chat tests writer"
---

# agentBody size caps are enforced by tests

## Context

Code review on branch `hpark0011/explain-profile-config-agent` (P2, tests lane). The caps in `packages/convex/convex/content/agentBody.ts:39-41` are the body-size invariant the agent write path relies on. `agentBody.test.ts` covers shape (paragraph/heading/bulletList), empty input, and unknown types — but nothing crosses the numeric thresholds.

## Goal

The three numeric caps in `agentBody.ts` are pinned by tests.

## Scope

- Add a test for `MAX_BLOCKS_PER_BODY`: pass 201 paragraph blocks → expect throw.
- Add a test for `MAX_TEXT_LENGTH_PER_BLOCK`: pass a paragraph with 4001 chars → expect throw.
- Add a test for `MAX_BULLET_ITEMS`: pass a bulletList with 51 items → expect throw.

## Out of Scope

- Changing the cap values.
- Adding caps for new dimensions (e.g., heading max length is currently covered by the same `MAX_TEXT_LENGTH_PER_BLOCK`).

## Approach

Three small test cases at the bottom of the `agentBlocksToTiptapDoc` describe block in `agentBody.test.ts`. Use `Array.from({ length: 201 }, ...)` and `'x'.repeat(4001)` to construct inputs.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Open `packages/convex/convex/content/__tests__/agentBody.test.ts`.
2. Add a test "rejects > MAX_BLOCKS_PER_BODY paragraph blocks" using `Array.from({ length: 201 }, (_, i) => ({ type: 'paragraph', text: `p${i}` }))` and `expect(() => agentBlocksToTiptapDoc(blocks)).toThrow(AgentBodyError)`.
3. Add a test "rejects paragraph text exceeding MAX_TEXT_LENGTH_PER_BLOCK" using `'x'.repeat(4001)`.
4. Add a test "rejects bulletList exceeding MAX_BULLET_ITEMS" using 51-item array.
5. Run `pnpm --filter=@feel-good/convex test`.

## Constraints

- Use the exported `AgentBodyError` (already imported in the test file).
- Do not import or reference the cap constants directly — the test inputs should hard-code the over-threshold count so a future tightening of a cap surfaces as a test failure to revisit.

## Resources

- `packages/convex/convex/content/agentBody.ts:39-41` (cap definitions).
