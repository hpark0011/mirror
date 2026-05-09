---
id: FG_200
title: "deleteOrphanCoverVideo test must assert ownership-row lifecycle"
date: 2026-05-08
type: fix
status: to-do
priority: p3
description: "The existing test asserts blob deletion via system.get returns null but says nothing about whether the corresponding coverImageOwnership row survives or is deleted. After FG_168 lands, this test must add the ownership-row assertion so the contract is documented."
dependencies: ["FG_168"]
parent_plan_id: PLAN_010
acceptance_criteria:
  - "The deleteOrphanCoverVideo test in packages/convex/convex/articles/__tests__/mutations.test.ts:858-903 adds an assertion that queries coverImageOwnership by storageId and asserts the row is deleted (after FG_168) or surviving (if the contract changes)"
  - "The same assertion is added to any new tests created by FG_167, FG_168, FG_179"
  - "`pnpm --filter=@feel-good/convex test` passes"
owner_agent: "QA Test Engineer"
---

# deleteOrphanCoverVideo Test Must Assert Ownership-Row Lifecycle

## Context

The existing test at `packages/convex/convex/articles/__tests__/mutations.test.ts:858-903` ("deleteOrphanCoverVideo deletes unreferenced blobs and preserves referenced ones") asserts:

```ts
expect(await t.run(async (ctx) => ctx.db.system.get(orphanVideoId))).toBeNull();
expect(await t.run(async (ctx) => ctx.db.system.get(orphanPosterId))).toBeNull();
```

It says nothing about the corresponding `coverImageOwnership` rows. After FG_168 lands (which adds row deletion to the orphan-cleanup mutation), this test must verify the row is gone — otherwise the contract isn't pinned and FG_168's correctness can silently regress.

If FG_168 doesn't land (the team decides ownership rows stay forever as audit log), this test still needs an assertion that the row IS preserved, so the chosen contract is documented in the test rather than left ambiguous.

- **Source:** Code review of PLAN_010 article-cover-video branch
- **Location:** `packages/convex/convex/articles/__tests__/mutations.test.ts:858-903`
- **Evidence:** Test asserts blob deletion only; no ownership-row state check.

## Goal

The orphan-cleanup test makes the ownership-row contract explicit — either "deleted" or "preserved" — so the chosen behavior cannot silently flip.

## Scope

- Update the existing `deleteOrphanCoverVideo` test to add ownership-row assertions matching whichever contract is chosen by FG_168.
- Apply the same pattern to any new tests added by FG_167, FG_168, or FG_179.

## Out of Scope

- Choosing the contract — FG_168 makes that decision.
- Adding tests for `deleteOrphanCoverImage` (those would belong to FG_167's test additions).

## Approach

After FG_168 lands (assume the chosen contract is "delete the row"):

```ts
it("deleteOrphanCoverVideo deletes unreferenced blobs AND their ownership rows", async () => {
  const t = makeT();
  await insertAppUserAndSignIn(t);

  const orphanVideoId = await storeBlobBytes(t);
  const orphanPosterId = await storeBlobBytes(t);
  await seedCoverOwnership(t, orphanVideoId, ownerAuthId);
  await seedCoverOwnership(t, orphanPosterId, ownerAuthId);

  await t.mutation(api.articles.mutations.deleteOrphanCoverVideo, {
    videoStorageId: orphanVideoId,
    posterStorageId: orphanPosterId,
  });

  expect(await t.run(async (ctx) => ctx.db.system.get(orphanVideoId))).toBeNull();
  expect(await t.run(async (ctx) => ctx.db.system.get(orphanPosterId))).toBeNull();

  // Ownership rows must also be gone (FG_168).
  const videoOwnerRow = await t.run(async (ctx) =>
    ctx.db.query("coverImageOwnership")
      .withIndex("by_storageId", (q) => q.eq("storageId", orphanVideoId))
      .unique()
  );
  const posterOwnerRow = await t.run(async (ctx) =>
    ctx.db.query("coverImageOwnership")
      .withIndex("by_storageId", (q) => q.eq("storageId", orphanPosterId))
      .unique()
  );
  expect(videoOwnerRow).toBeNull();
  expect(posterOwnerRow).toBeNull();
});
```

If the contract is "preserve" (rejecting FG_168), invert the assertions and rename to `…AND preserves their ownership rows`.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. After FG_168 ships, update the existing test (line 858) to seed `coverImageOwnership` rows via `seedCoverOwnership` AND assert their post-mutation state.
2. Update the parallel test ("preserves referenced ones") similarly — referenced ownership rows must survive.
3. Run `pnpm --filter=@feel-good/convex test`.

## Constraints

- This ticket is gated on FG_168's resolution — don't attempt to ship before that contract is decided.
- Use existing helpers (`seedCoverOwnership`, `makeT`).

## Resources

- Source: `packages/convex/convex/articles/__tests__/mutations.test.ts:858-903`
- Helper: `seedCoverOwnership` (lines 591-608)
- Related: FG_168 (production-code change), FG_179 (broader cleanup paths)
