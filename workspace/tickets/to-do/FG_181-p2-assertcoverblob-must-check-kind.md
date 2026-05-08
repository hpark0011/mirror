---
id: FG_181
title: "assertCoverBlobOwnership must verify the blob kind matches the consumer field"
date: 2026-05-08
type: fix
status: to-do
priority: p2
description: "All three claim mutations insert into coverImageOwnership with no kind discriminator. assertCoverBlobOwnership only checks ownership-table membership. A poster-claimed blob can be submitted as coverImageStorageId; an MP4 blob can be submitted as coverVideoPosterStorageId — bypassing per-kind MIME and size policies."
dependencies: ["FG_182", "FG_196"]
parent_plan_id: PLAN_010
acceptance_criteria:
  - "`grep -n 'kind' packages/convex/convex/articles/schema.ts` shows a kind field on coverImageOwnership"
  - "All three claim mutations set kind on insert; assertCoverBlobOwnership accepts an expected-kind argument and checks the row's kind matches"
  - "A convex-test case calls articles.create with a video-claimed storageId in the coverImageStorageId slot and asserts the call rejects"
  - "`pnpm --filter=@feel-good/convex test` passes"
owner_agent: "Convex Backend Security Engineer"
---

# assertCoverBlobOwnership Must Verify the Blob Kind Matches the Consumer Field

## Context

`assertCoverBlobOwnership` (`packages/convex/convex/articles/mutations.ts:44-56`) takes a `storageId` and verifies the calling user owns the blob via `coverImageOwnership` table lookup. It does NOT verify what KIND of blob was claimed.

All three claim mutations insert into the same table with no `kind` field:
- `claimCoverImageOwnership` (lines 646-669) — no MIME check (FG_182 fixes this)
- `claimCoverVideoOwnership` (lines 704-744) — checks MIME = `video/mp4`, size ≤ 25 MiB
- `claimCoverVideoPosterOwnership` (lines 752-791) — checks MIME starts with `image/`, size ≤ 5 MiB

Because the assertion is kind-blind, a user can:
1. Upload an MP4, call `claimCoverVideoOwnership` (passes 25 MiB cap, MIME check)
2. Submit that storage id as `coverVideoPosterStorageId` in `articles.update` — the assertion finds the ownership row and passes
3. The article row has a 25 MiB MP4 as its "poster image"

Or in the other direction:
1. Upload a 4 MiB JPEG, call `claimCoverVideoPosterOwnership` (passes loose `image/*` check)
2. Submit as `coverImageStorageId` — bypasses any future MIME tightening on `claimCoverImageOwnership`

This is a security-defense-in-depth gap, not an immediate auth bypass — but combined with FG_182 (MIME gap on `claimCoverImageOwnership`) it expands the cross-kind reuse surface.

- **Source:** Code review of PLAN_010 article-cover-video branch
- **Location:** `packages/convex/convex/articles/mutations.ts:44-56`
- **Evidence:** No `kind` column in `coverImageOwnership`; assertion only checks ownership.

## Goal

Each cover field accepts only blobs claimed for that exact kind. Cross-kind blob reuse is rejected at the `articles.create` / `articles.update` boundary.

## Scope

- Add a `kind` field to `coverImageOwnership` with a backfill that defaults existing rows to `'image'`.
- Set `kind` in each claim mutation.
- Update `assertCoverBlobOwnership` to take an `expectedKind` argument and check it.
- Update each call site in `articles.create` / `articles.update` to pass the right `expectedKind`.

## Out of Scope

- Renaming the table to `coverBlobOwnership` (FG_198 — pure naming).
- Tightening `claimCoverImageOwnership` MIME (FG_182).

## Approach

Schema:
```ts
export const coverImageOwnershipFields = {
  storageId: v.id("_storage"),
  userId: v.id("users"),
  createdAt: v.number(),
  kind: v.union(v.literal("image"), v.literal("video"), v.literal("poster")),
};
```

Backfill (one-time mutation):
```ts
// Sets kind="image" on all existing rows.
```

Assertion:
```ts
async function assertCoverBlobOwnership(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
  userId: Id<"users">,
  expectedKind: "image" | "video" | "poster",
): Promise<void> {
  const row = await ctx.db.query("coverImageOwnership").withIndex(...).unique();
  if (!row || row.userId !== userId) {
    throw new ConvexError("cover blob storage id does not belong to caller");
  }
  if (row.kind !== expectedKind) {
    throw new ConvexError(
      `cover blob is ${row.kind}, cannot be used as ${expectedKind}`,
    );
  }
}
```

- **Effort:** Medium
- **Risk:** Medium (schema change + backfill)

## Implementation Steps

1. Coordinate with FG_196 (which adds the kind discriminator). FG_181 ships alongside it as the consumer of the new field.
2. In `mutations.ts`, update `assertCoverBlobOwnership` signature to require `expectedKind`.
3. Update call sites in `articles.create` and `articles.update` to pass `'image' | 'video' | 'poster'`.
4. Update each claim mutation to insert `kind` matching its purpose.
5. Add convex-test cases: cross-kind submission rejects (e.g., video-claimed id used as poster, poster-claimed id used as image).
6. Run `pnpm --filter=@feel-good/convex test`.

## Constraints

- Schema change is non-breaking on Convex (new optional field would be needed if we couldn't backfill, but since we control all writes, requiring `kind` and backfilling is fine).
- The backfill must run before any new code is deployed to avoid existing image-claim rows failing the kind check.

## Resources

- Source: `packages/convex/convex/articles/mutations.ts:44-56` and the three claim mutations
- Related: FG_182 (MIME tightening), FG_196 (kind field add).
