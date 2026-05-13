---
id: FG_218
title: "applyContactEntryPatch has an all-or-nothing atomicity test"
date: 2026-05-13
type: chore
status: completed
priority: p2
description: "applyBioEntryPatch has a mid-batch-failure test that proves Convex transaction rollback covers partial batches. The symmetric applyContactEntryPatch has only a happy-path test. A regression that commits partial contact-patch batches would not be caught by the suite."
dependencies: []
parent_plan_id: workspace/plans/2026-05-13-profile-configuration-helper-agent-plan.md
acceptance_criteria:
  - "packages/convex/convex/chat/__tests__/tools.test.ts contains a test that sends applyContactEntryPatch with at least two operations where the second is invalid (e.g., mismatched kind/value or unsupported kind), asserts the mutation throws, and asserts zero contactEntries rows exist for the owner afterwards"
  - "The test mirrors the shape of the existing 'applyBioEntryPatch is all-or-nothing when a later operation fails validation' test at tools.test.ts:2371"
  - "pnpm --filter=@feel-good/convex exec vitest run convex/chat/__tests__/tools.test.ts passes"
owner_agent: "Convex test engineer"
---

# applyContactEntryPatch has an all-or-nothing atomicity test

## Context

The intent packet for PR #93 lists "patch tools all-or-nothing" as invariant #5. `applyBioEntryPatch` has an explicit test for this at `packages/convex/convex/chat/__tests__/tools.test.ts:2371`:

```ts
it("applyBioEntryPatch is all-or-nothing when a later operation fails validation", async () => {
  // seeds two operations, second has empty title, asserts throws + zero rows
});
```

The symmetric `applyContactEntryPatch` test only covers the happy path (`tools.test.ts:2406` — `applyContactEntryPatch returns the pinned shape for upsert and delete`). There is no mid-batch-failure case.

The production code (`packages/convex/convex/chat/toolMutations.ts:430-450`) processes operations in a for-loop with awaited DB calls. Convex transaction semantics SHOULD roll back the whole batch on any throw — but this is not currently pinned by a test. A regression that catches+swallows an error mid-loop, or that uses a non-transactional pattern, would silently violate the invariant.

## Goal

A regression that commits partial contact-patch batches is caught by the test suite before it can land.

## Scope

- One new test in `packages/convex/convex/chat/__tests__/tools.test.ts` mirroring the bio atomicity test.
- After FG_209 (hostname-vs-kind enforcement) lands, this test can use a mismatched-host failure mode; before FG_209 lands, use an empty-string value or any failing validation path.

## Out of Scope

- Refactoring the bio atomicity test.
- Adding atomicity tests for other mutations.

## Approach

Add a new `it(...)` adjacent to the bio test:

```ts
it("applyContactEntryPatch is all-or-nothing when a later operation fails validation", async () => {
  const t = makeT();
  const owner = await insertOwner(t, "owner_contact_patch_atomic");

  await expect(
    t.mutation(internal.chat.toolMutations.applyContactEntryPatch, {
      userId: owner,
      operations: [
        {
          action: "set",
          kind: "linkedin",
          value: "https://www.linkedin.com/in/owner-contact-patch-atomic",
        },
        {
          action: "set",
          kind: "linkedin",
          value: "", // invalid: empty value
        },
      ],
    }),
  ).rejects.toThrow();

  const rows = await t.run(async (ctx) =>
    ctx.db
      .query("contactEntries")
      .withIndex("by_userId", (q) => q.eq("userId", owner))
      .collect(),
  );
  expect(rows).toHaveLength(0);
});
```

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Open `packages/convex/convex/chat/__tests__/tools.test.ts` and locate the bio atomicity test (around line 2371).
2. Add the new contact atomicity test below it.
3. Run `pnpm --filter=@feel-good/convex exec vitest run convex/chat/__tests__/tools.test.ts` and confirm it passes.
4. Manually break the production loop (temporarily wrap the for-body in `try { ... } catch {}`), re-run, and confirm the test fails. Revert.

## Constraints

- Test must not depend on FG_209 hostname-vs-kind enforcement landing first — use a different failure trigger.
- Test must clean up state between runs (the `makeT()` helper handles this).

## Resources

- PR #93 tests review: `contact-patch-atomicity-not-tested`
- `packages/convex/convex/chat/__tests__/tools.test.ts:2371` — bio atomicity reference test
- `packages/convex/convex/chat/toolMutations.ts:430-450` — applyContactEntryPatch implementation
