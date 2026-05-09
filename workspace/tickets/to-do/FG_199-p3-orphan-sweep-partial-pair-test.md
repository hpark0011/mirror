---
id: FG_199
title: "Orphan sweep needs a partial-pair test (only poster orphaned, video referenced)"
date: 2026-05-08
type: fix
status: to-do
priority: p3
description: "The PLAN_010 sweep test always orphans the video+poster pair together. If a future change accidentally merges the per-blob reference checks, the sweep could incorrectly preserve or delete a blob when only one of the pair is orphaned."
dependencies: []
parent_plan_id: PLAN_010
acceptance_criteria:
  - "A new test in packages/convex/convex/content/__tests__/orphanSweep.test.ts seeds an article that references coverVideoStorageId but has coverVideoPosterStorageId orphaned, advances past grace, runs the sweep, asserts the video survives and the poster is deleted"
  - "A sibling test does the inverse (poster referenced, video orphaned)"
  - "`pnpm --filter=@feel-good/convex test` passes"
owner_agent: "QA Test Engineer"
---

# Orphan Sweep Needs a Partial-Pair Test (Only Poster Orphaned, Video Referenced)

## Context

The PLAN_010 sweep test at `packages/convex/convex/content/__tests__/orphanSweep.test.ts:126-172` ("sweeps the previous video + poster after a video-cover replace") always orphans both video AND poster together. The article references the NEW pair while the OLD pair is unreferenced, and the sweep deletes both old blobs.

The sweep walks `STORAGE_FIELD_REFERENCES`, building a single `referenced` set that includes EVERY storage id in EVERY registered field. Then it iterates all `_storage` blobs and deletes those not in the set. Per-blob reference checks are independent: each `_storage` row is checked against the union, not against per-field subsets.

This means: if an article has `coverVideoStorageId = X` but `coverVideoPosterStorageId = undefined` (or pointing at an orphaned blob Y), the sweep should preserve X and delete Y. There is no test exercising this asymmetric case.

If a future change accidentally couples the per-blob checks (e.g., "only sweep the pair together") or if the registry walk is broken in a way that drops a single field, the sweep could delete a referenced blob.

- **Source:** Code review of PLAN_010 article-cover-video branch
- **Location:** `packages/convex/convex/content/__tests__/orphanSweep.test.ts:126-172`
- **Evidence:** Existing test always orphans both blobs simultaneously.

## Goal

The orphan sweep's per-blob independence is pinned by a regression test that catches accidental coupling.

## Scope

- Add one test where article references the video but poster is orphaned.
- Add one test where article references the poster but video is orphaned.

## Out of Scope

- Testing the per-blob independence for image vs. inline-body (different code path; existing tests cover it).
- Refactoring the sweep itself.

## Approach

```ts
it("preserves the video blob when only the poster is orphaned (PLAN_010)", async () => {
  const t = makeT();

  vi.useFakeTimers();
  vi.setSystemTime(0);

  const refVideo = await storeBlob(t, "ref-video");
  const orphanPoster = await storeBlob(t, "orphan-poster");

  const userId = await t.run(async (ctx) =>
    ctx.db.insert("users", {
      authId: "auth-partial-orphan-poster",
      email: "po@example.com",
      onboardingComplete: true,
    }),
  );
  // Article references the video; poster field is undefined.
  // The orphanPoster blob is unreferenced.
  await t.run(async (ctx) =>
    ctx.db.insert("articles", {
      userId,
      slug: "partial-poster",
      title: "Partial Poster",
      body: { type: "doc", content: [] },
      coverVideoStorageId: refVideo,
      // coverVideoPosterStorageId intentionally undefined
      category: "general",
      status: "published",
      createdAt: 0,
    }),
  );

  vi.setSystemTime(ORPHAN_GRACE_MS + 60 * 60 * 1000);
  await t.mutation(internal.crons.sweepOrphanedStorage, {});
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  vi.useRealTimers();

  expect(await blobExists(t, refVideo)).toBe(true);
  expect(await blobExists(t, orphanPoster)).toBe(false);
});
```

Mirror the inverse test (poster referenced, video orphaned).

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Add the two tests to `packages/convex/convex/content/__tests__/orphanSweep.test.ts` next to the existing PLAN_010 test (line 126).
2. Run `pnpm --filter=@feel-good/convex test`.

## Constraints

- Use the existing `storeBlob`, `blobExists`, `makeT` test helpers — no new infrastructure.
- The test seeds an article in an "intentionally invalid" state (video without poster). This is reachable in production only by direct DB manipulation, but the sweep must still behave correctly.

## Resources

- Source: `packages/convex/convex/content/__tests__/orphanSweep.test.ts:126-172`
- Existing helpers: `storeBlob`, `blobExists`, `makeT`, `ORPHAN_GRACE_MS`
