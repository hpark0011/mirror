---
id: FG_217
title: "collectAllKeys walks discriminated-union variants inside arrays"
date: 2026-05-13
type: chore
status: to-do
priority: p2
description: "The collectAllKeys helper in tools.test.ts pins the no-userId-in-inputSchema invariant by recursing into .shape. It does not recurse into z.discriminatedUnion variants or z.array element schemas, so a future userId added inside a bioOperationSchema variant would pass the test silently."
dependencies: []
parent_plan_id: workspace/plans/2026-05-13-profile-configuration-helper-agent-plan.md
acceptance_criteria:
  - "collectAllKeys (or its replacement) recurses into z.array element schemas and z.discriminatedUnion .options variants"
  - "A unit test asserts that adding a userId field to any bioOperationSchema or contactOperationSchema variant causes the inputSchema-invariants test to fail"
  - "The existing inputSchema invariant tests for the four configuration tools continue to pass with the deeper walker"
  - "pnpm --filter=@feel-good/convex exec vitest run convex/chat/__tests__/tools.test.ts passes"
owner_agent: "Convex test engineer"
---

# collectAllKeys walks discriminated-union variants inside arrays

## Context

`packages/convex/convex/chat/__tests__/tools.test.ts:1174-1183` defines:

```ts
function collectAllKeys(shape: Record<string, unknown>): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(shape)) {
    keys.push(k);
    const nestedShape = (v as { shape?: Record<string, unknown> })?.shape;
    if (nestedShape) keys.push(...collectAllKeys(nestedShape));
  }
  return keys;
}
```

The helper recurses on `.shape` only. The configuration tools `applyBioEntryPatch` and `applyContactEntryPatch` declare their input as:

```ts
inputSchema: z.object({
  operations: z.array(bioOperationSchema).min(1).max(10),
})
```

where `bioOperationSchema = z.discriminatedUnion("action", [...])`. Each variant in the union has its own `.shape`, but `collectAllKeys` never reaches them — it sees `operations` and stops because `z.array(...)` has no `.shape`.

The agent-native reviewer confirmed: the test currently sees `allKeys === ["operations"]` for `applyBioEntryPatch`. The invariant assertion (`!/userId|...|profileOwnerId/i.test(k)`) trivially holds. A future author could add `userId: z.string()` inside a `bioOperationSchema` create variant and the test would silently pass — breaking the cross-user isolation contract documented in `.claude/rules/agent-parity.md`.

## Goal

The inputSchema-invariants test for configuration tools fails immediately if any nested variant inside an array of discriminated unions includes a user-identifier field.

## Scope

- `packages/convex/convex/chat/__tests__/tools.test.ts` — extend `collectAllKeys` to walk array element schemas and discriminated-union options.
- A negative test that proves the walker catches a violation (temporarily wire a userId, assert failure, remove).

## Out of Scope

- Refactoring all `inputSchema invariants` tests to use a different shape.
- Adding similar coverage for the clone-tools side (they use simpler shapes that the existing walker already covers).

## Approach

Add two more recursion branches to `collectAllKeys`:

```ts
function collectAllKeys(shape: Record<string, unknown>): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(shape)) {
    keys.push(k);
    const nestedShape = (v as { shape?: Record<string, unknown> })?.shape;
    if (nestedShape) keys.push(...collectAllKeys(nestedShape));

    // Walk array element schemas
    const elementSchema =
      (v as { element?: { shape?: Record<string, unknown>; options?: unknown[] } })?.element;
    if (elementSchema) keys.push(...collectAllKeysOfSchema(elementSchema));

    // Walk discriminated-union variants
    const options = (v as { options?: unknown[] })?.options;
    if (Array.isArray(options)) {
      for (const variant of options) {
        keys.push(...collectAllKeysOfSchema(variant));
      }
    }
  }
  return keys;
}

function collectAllKeysOfSchema(schema: unknown): string[] {
  const variantShape = (schema as { shape?: Record<string, unknown> })?.shape;
  return variantShape ? collectAllKeys(variantShape) : [];
}
```

Verify by temporarily inserting `userId: z.string()` into one variant, running the test, confirming it fails, then removing.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Extend `collectAllKeys` in `tools.test.ts` as described above.
2. Re-run the existing `configuration tools expose no user identifier in their LLM-visible schema` test — it should still pass.
3. Manually verify by adding `userId: z.string()` to the `create` variant of `bioOperationSchema` in `configurationTools.ts`, running the test, confirming it fails, then reverting.
4. Optionally add a dedicated test that constructs a contrived schema with a nested userId and asserts the walker catches it — this hardens against future regressions in the walker itself.

## Constraints

- Must not change the public API of `collectAllKeys`.
- Must not slow the test materially (tests should still run in well under 100ms each).
- Must preserve the existing positive case behavior (all four config tools still pass the no-userId assertion).

## Resources

- PR #93 agent-native review: `config-tools-test-collectallkeys-no-union-walk`
- `.claude/rules/agent-parity.md` — cross-user isolation invariant
- `packages/convex/convex/chat/__tests__/tools.test.ts:1174-1506`
