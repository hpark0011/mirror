---
id: FG_130
title: "Tool inputSchema user-identifier invariant test asserts on schema keys, not stringified _def"
date: 2026-05-05
type: improvement
status: to-do
priority: p2
description: "The cross-user isolation test in tools.test.ts checks that no `userId`-shaped field appears anywhere in `JSON.stringify(schema._def)`, including Zod description strings. A future tool-description edit mentioning the word 'userId' (e.g., 'do not pass userId') would fail the test even though the schema's actual fields are still safe. This pushes future authors to loosen the regex, which silently weakens defense-in-depth. Scope the regex to schema keys only."
dependencies: []
parent_plan_id: docs/plans/2026-05-04-feat-agent-ui-parity-plan.md
acceptance_criteria:
  - "The two `inputSchema invariants` test cases at `tools.test.ts:407-410` and `tools.test.ts:422-426` no longer use `JSON.stringify(schema._def)`"
  - "Each test instead extracts `Object.keys(schema.shape)` (and recursively, keys of any nested z.object shapes) and asserts none match `/userId|user_id|ownerId/i`"
  - "The new key-scoped check still catches a regression that adds `userId` to either tool's `inputSchema`. A targeted regression-proof: temporarily add `userId: z.id('users')` to `getLatestPublished.inputSchema`, run the test, confirm it fails with the new assertion shape; revert the temporary change"
  - "The existing positive `Object.keys(schema.shape).sort()` assertions at lines 434/442 are preserved unchanged"
  - "A tool description string containing the literal word 'userId' (e.g., 'never pass userId') does NOT cause the test to fail"
  - "`pnpm --filter=@feel-good/convex test:unit packages/convex/convex/chat/__tests__/tools.test.ts` passes"
owner_agent: "Convex chat backend developer"
---

# Tool inputSchema user-identifier invariant test asserts on schema keys, not stringified _def

## Context

Code review on `feature-agent-parity-architecture` (tests reviewer, P2 0.80) flagged that the cross-user isolation invariant test is brittle.

`packages/convex/convex/chat/__tests__/tools.test.ts:407-410` (and the matching block at lines 422-426):

```ts
const serialized = JSON.stringify(schema!._def);
expect(serialized).not.toMatch(/userId/i);
expect(serialized).not.toMatch(/profileOwnerId/i);
```

`schema._def` includes Zod **description** strings — tool argument descriptions like "do not pass any user identifier" (from `tools.ts:54`). Today neither tool's description literally says "userId," so the regex passes. But the test is fragile to natural-language changes:

- A future author writes: `description: "Open an article. Do not pass userId."` — the test fails.
- The author "fixes" the test by loosening the regex to `/^userId/i` or removing the `_def` check entirely. The defense-in-depth layer is gone.
- Or worse: the author adds `userId` to the schema *and* phrases the description so the regex still passes, and nobody notices.

The authoritative invariant is: **the schema's field shape contains no user-identifier key**. That is exactly `Object.keys(schema.shape)` — the existing positive assertion at line 434 (`expect(Object.keys(schema.shape).sort()).toEqual(["kind"])`). The `_def` regex is meant as defense-in-depth, but it's defending the wrong surface.

## Goal

The cross-user invariant test fails immediately and only when a tool's input schema gains a user-identifier field, regardless of what the tool's natural-language description says.

## Scope

- Replace the two `JSON.stringify(schema._def)` regex blocks at `tools.test.ts:407-410` and `:422-426` with a key-scoped check.
- The new check must walk `schema.shape` (and recursively any nested `z.object` shapes the future may bring) and assert every key fails `/^(userId|user_id|ownerId)$/i`.
- Keep the existing `Object.keys(schema.shape).sort()` assertions at lines 434 and 442 — those are the authoritative positive checks; the new check is the catch-all defense-in-depth that survives schema refactors (e.g., a wrapping `z.discriminatedUnion`).
- Add a brief comment explaining why this layer exists (description text is not the trust boundary; schema keys are).

## Out of Scope

- Changing Zod versions or the `createTool` API.
- Modifying the production tool definitions in `tools.ts` or `toolQueries.ts`.
- Adding new isolation tests beyond the two existing describe blocks.
- Adding tests for nested objects — today neither tool has nested objects in its inputSchema, so the recursive walk is a forward-compatibility safeguard.

## Approach

Build a small helper inside the test file:

```ts
function collectAllKeys(shape: Record<string, unknown>): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(shape)) {
    keys.push(k);
    // If v is a Zod object, recurse into its shape.
    const nestedShape = (v as { shape?: Record<string, unknown> })?.shape;
    if (nestedShape) keys.push(...collectAllKeys(nestedShape));
  }
  return keys;
}

const allKeys = collectAllKeys(schema!.shape!);
expect(allKeys.every((k) => !/^(userId|user_id|ownerId)$/i.test(k))).toBe(true);
```

This catches `userId` at the top level (today's case), at any depth (forward), and across kind variants (e.g., a `z.discriminatedUnion` whose option contains `userId`). It does NOT catch description text, which is correct.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Open `packages/convex/convex/chat/__tests__/tools.test.ts`.
2. Add a `collectAllKeys` helper function near the top of the file (or inline at the top of the `inputSchema invariants` describe block).
3. Replace the `serialized` block in the `getLatestPublished.inputSchema` test (lines 407-410) with a key-walk + regex check.
4. Replace the same block in the `navigateToContent.inputSchema` test (lines 422-426).
5. Add a one-line comment above the new check explaining the rationale: "Description strings are not the trust boundary; schema keys are."
6. Verify regression-proof: temporarily add `userId: z.id("users")` to the production `getLatestPublished.inputSchema`, run the test, confirm it fails. Revert.
7. Run `pnpm --filter=@feel-good/convex test:unit packages/convex/convex/chat/__tests__/tools.test.ts`.
8. Run `pnpm build --filter=@feel-good/mirror` and `pnpm lint --filter=@feel-good/mirror` to make sure no incidental drift.

## Constraints

- Do not remove the existing `Object.keys(schema.shape).sort()` positive assertions at lines 434 and 442.
- Do not add new descriptions to the production tools in this ticket.
- The helper function must not be exported from the test file.

## Resources

- `.claude/rules/agent-parity.md` § Cross-user isolation invariant
- `.claude/rules/embeddings.md` (the parent rule the agent-parity rule extends)
- Code review report from `/review-code` on `feature-agent-parity-architecture` (2026-05-05) — P2 #4
- Zod v4 schema introspection: `schema.shape` is the canonical surface
