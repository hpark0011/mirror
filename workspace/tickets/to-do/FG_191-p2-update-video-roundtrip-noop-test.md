---
id: FG_191
title: "articles.update Branch 5 (video round-trip no-op) needs a regression test"
date: 2026-05-08
type: fix
status: to-do
priority: p2
description: "There is a Branch 4 test for the image round-trip case but no analogous test for video — caller sends back the same coverVideoStorageId + coverVideoPosterStorageId and the row should be unchanged. If the != predicate were inverted, the round-trip would delete the live video blobs."
dependencies: []
parent_plan_id: PLAN_010
acceptance_criteria:
  - "A new test in packages/convex/convex/articles/__tests__/mutations.test.ts inside the PLAN_010 describe block creates an article with video+poster, calls update with the same coverVideoStorageId and coverVideoPosterStorageId, asserts the row's storage ids and the blobs are unchanged"
  - "The test also asserts that no `safeDeleteStorage` was called for either blob (e.g., by spying or by checking system.get returns the original blob)"
  - "`pnpm --filter=@feel-good/convex test` passes"
owner_agent: "QA Test Engineer"
---

# articles.update Branch 5 (Video Round-Trip No-Op) Needs a Regression Test

## Context

The `update` mutation's cover-patch logic at `packages/convex/convex/articles/mutations.ts:422-456` has five branches:

1. clearCoverImage:true → wipe everything
2. video changed → replace
3. image changed → replace
4. image-thumbhash-only patch
5. round-trip no-op (caller sent back same ids → no patch fields written)

The image equivalent of Branch 5 is tested at `mutations.test.ts:444-471` ("update with the same coverImageStorageId and same/no coverImageThumbhash is a no-op"). The video equivalent — caller sends back the same `coverVideoStorageId` and `coverVideoPosterStorageId` — is NOT tested.

If a future regression inverts the `!==` predicate at line 435 (Branch 2's condition), the round-trip case would erroneously enter Branch 2 and delete the live video blobs because `replacedVideo=true` would fire the cascade-delete.

- **Source:** Code review of PLAN_010 article-cover-video branch
- **Location:** `packages/convex/convex/articles/__tests__/mutations.test.ts` (PLAN_010 describe block)
- **Evidence:** No test where save-with-same-video-ids verifies the row is unchanged.

## Goal

A failing regression test pins Branch 5 for the video case: same ids → row unchanged → no blob deletes.

## Scope

- Add one test to the existing PLAN_010 describe block in `mutations.test.ts`.

## Out of Scope

- Refactoring the branch logic (FG_180 covers Branch 2's poster-only edge).
- Testing other no-op shapes (image+video both unchanged, etc.).

## Approach

```ts
it("update with the same video and poster ids is a round-trip no-op (Branch 5)", async () => {
  const t = makeT();
  await insertAppUserAndSignIn(t);

  const videoId = await storeBlobBytes(t);
  const posterId = await storeBlobBytes(t);
  await seedCoverOwnership(t, videoId, ownerAuthId);
  await seedCoverOwnership(t, posterId, ownerAuthId);

  const id = await t.mutation(api.articles.mutations.create, {
    title: "Round Trip",
    category: "general",
    body: { type: "doc", content: [] },
    status: "draft",
    coverVideoStorageId: videoId,
    coverVideoPosterStorageId: posterId,
  });

  await t.mutation(api.articles.mutations.update, {
    id,
    coverVideoStorageId: videoId,        // SAME id
    coverVideoPosterStorageId: posterId, // SAME id
  });

  const row = await t.run(async (ctx) => ctx.db.get(id));
  expect(row?.coverVideoStorageId).toBe(videoId);
  expect(row?.coverVideoPosterStorageId).toBe(posterId);

  // Both blobs still alive — proves no cascade-delete fired.
  expect(await t.run(async (ctx) => ctx.db.system.get(videoId))).not.toBeNull();
  expect(await t.run(async (ctx) => ctx.db.system.get(posterId))).not.toBeNull();
});
```

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Add the test to the PLAN_010 describe block in `mutations.test.ts`, after the existing video-replace test.
2. Run `pnpm --filter=@feel-good/convex test`.

## Constraints

- Use the existing test helpers (`makeT`, `storeBlobBytes`, `seedCoverOwnership`).
- Don't change production code.

## Resources

- Source: `packages/convex/convex/articles/mutations.ts:419,433-456`
- Existing test: `mutations.test.ts:444-471` (image equivalent)
