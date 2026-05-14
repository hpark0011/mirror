---
id: FG_214
title: "applyContentPatch update preserves body when bodyBlocks is omitted"
date: 2026-05-14
type: improvement
status: to-do
priority: p2
description: "The update branch of `applyContentPatch` only computes a body when `op.bodyBlocks !== undefined`, leaving the persisted body untouched otherwise. No test pins this behavior — the conditional guard could regress to always-convert and silently overwrite content bodies with a single empty paragraph."
dependencies: []
parent_plan_id: workspace/plans/2026-05-14-config-agent-content-authoring-plan.md
acceptance_criteria:
  - "A test in the `applyContentPatch` describe block seeds a post with a non-empty body, calls `applyContentPatch` with an update operation that includes a title change and omits `bodyBlocks`, and asserts the DB row's `body` field is deep-equal to the original."
  - "`pnpm --filter=@feel-good/convex test` exits 0."
  - "Removing the `op.bodyBlocks !== undefined ? ... : undefined` conditional in `chat/toolMutations.ts:668-675` causes the new test to fail."
owner_agent: "Convex chat tests writer"
---

# applyContentPatch update preserves body when bodyBlocks is omitted

## Context

Code review on branch `hpark0011/explain-profile-config-agent` (P2, tests lane). PLAN_013 lists "update title, category, status, slug, and body without changing omitted fields" as a coverage requirement. The current update test (`tools.test.ts:2915-2961`) always supplies `bodyBlocks`. The conditional `op.bodyBlocks !== undefined ? (() => { const doc = agentBlocksToTiptapDoc(op.bodyBlocks); assertAgentSafeBody(doc); return doc; })() : undefined` at `chat/toolMutations.ts:668-675` is the contract that omitting `bodyBlocks` preserves the existing body — but no test pins it.

## Goal

The "omit bodyBlocks → body unchanged" invariant is locked in by a regression test.

## Scope

- Add a test that seeds a post with a specific multi-block body, runs an `applyContentPatch` update with only a title change, and asserts the persisted body matches the seeded body bit-for-bit.

## Out of Scope

- Adding the parallel article test (the code path is the same; one kind is sufficient to pin the guard).
- Testing partial body block replacement (the schema is whole-body replacement only).

## Approach

Seed via `t.run(async (ctx) => ctx.db.insert("posts", { body: { type: 'doc', content: [...non-trivial...] }, status: 'draft', ... }))`, run the mutation, fetch the row, assert `row.body` equals the seed.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. In `packages/convex/convex/chat/__tests__/tools.test.ts` `applyContentPatch` describe, add a test "leaves body untouched when bodyBlocks is omitted on update".
2. Seed a post with `body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Untouched' }] }] }`.
3. Call `applyContentPatch` with `{ action: 'update', kind: 'posts', slug, title: 'New title' }` — note no `bodyBlocks`.
4. Fetch the row and assert `body` deep-equals the seeded value AND `title` equals "New title".
5. Run `pnpm --filter=@feel-good/convex test`.

## Constraints

- Test-only change; do not touch production code.
- Use `toEqual` (deep equality) on the body, not `toBe` (reference identity).

## Resources

- PLAN_013 coverage requirements.
- Existing update test as a template (`tools.test.ts:2915-2961`).
