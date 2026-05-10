---
id: FG_182
title: "claimCoverImageOwnership must validate MIME and size like its video sibling"
date: 2026-05-08
type: fix
status: completed
priority: p2
description: "claimCoverImageOwnership performs no contentType or size validation. A user can upload SVG, GIF, TIFF, or arbitrarily large files and claim them as cover images. The image cover path goes through next/image which sandboxes some risks, but any direct fetch of the storage URL serves whatever Convex stored."
dependencies: []
parent_plan_id: PLAN_010
acceptance_criteria:
  - "claimCoverImageOwnership reads `_storage` metadata via `ctx.db.system.get` and rejects when contentType is not in ALLOWED_INLINE_IMAGE_TYPES"
  - "claimCoverImageOwnership rejects when size > MAX_INLINE_IMAGE_BYTES and calls safeDeleteStorage on the offending blob"
  - "claimCoverVideoPosterOwnership tightened to use ALLOWED_INLINE_IMAGE_TYPES.has(contentType) instead of `startsWith('image/')`"
  - "Convex-test cases for each reject path; `pnpm --filter=@feel-good/convex test` passes"
owner_agent: "Convex Backend Security Engineer"
---

# claimCoverImageOwnership Must Validate MIME and Size Like Its Video Sibling

## Context

`claimCoverImageOwnership` (`packages/convex/convex/articles/mutations.ts:646-669`) performs no MIME validation, no size validation. The handler:

```ts
export const claimCoverImageOwnership = authMutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const appUser = await getAppUser(ctx, ctx.user._id);
    const existing = await ctx.db.query("coverImageOwnership").…;
    if (existing) return null;
    await ctx.db.insert("coverImageOwnership", { storageId, userId, createdAt });
  },
});
```

Any blob is claimable. A user can upload:
- An SVG (XSS risk if rendered inline by future code paths)
- A 100 MB image (DoS / billing risk)
- A non-image file with a misleading extension

The new `claimCoverVideoPosterOwnership` (lines 752-791) is slightly better — it checks `contentType.startsWith("image/")` — but still admits SVG, GIF, BMP, TIFF, etc. The inline-image policy (`storagePolicy.ts:31-35`) deliberately allows only `image/png`, `image/jpeg`, `image/webp`. The cover-image-claim path doesn't enforce that policy.

Combined with FG_181 (kind-blind assertion), this creates a real hole: poster-claim with `image/svg+xml` → submit as `coverImageStorageId` → article cover is an SVG → if any future direct-fetch path renders it inline (not next/image), this becomes XSS-shaped.

- **Source:** Code review of PLAN_010 article-cover-video branch
- **Location:** `packages/convex/convex/articles/mutations.ts:646-669` (image) and `:752-791` (poster)
- **Evidence:** No `meta.contentType` or `meta.size` check in `claimCoverImageOwnership`.

## Goal

Both `claimCoverImageOwnership` and `claimCoverVideoPosterOwnership` enforce the inline-image MIME allowlist (PNG/JPEG/WEBP only) and the 5 MiB size cap. Rejected blobs are deleted immediately.

## Scope

- Add `_storage` metadata read + MIME + size validation to `claimCoverImageOwnership`, mirroring `claimCoverVideoOwnership`'s shape.
- Tighten `claimCoverVideoPosterOwnership` to use `ALLOWED_INLINE_IMAGE_TYPES` instead of the loose `startsWith('image/')`.
- Add convex-test cases for each reject path.

## Out of Scope

- Adding a `kind` discriminator to the ownership table (FG_181, FG_196).
- Tightening MIME on the inline-image upload path (separate concern, separate file).

## Approach

```ts
export const claimCoverImageOwnership = authMutation({
  args: { storageId: v.id("_storage") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const appUser = await getAppUser(ctx, ctx.user._id);

    const meta = await ctx.db.system.get(args.storageId);
    if (!meta) {
      throw new ConvexError("cover image blob not found in storage");
    }
    const contentType = meta.contentType ?? "";
    if (!ALLOWED_INLINE_IMAGE_TYPES.has(contentType)) {
      await safeDeleteStorage(ctx, args.storageId);
      throw new ConvexError(
        `cover image must be one of ${[...ALLOWED_INLINE_IMAGE_TYPES].join(", ")}; got "${contentType}"`,
      );
    }
    if (meta.size > MAX_INLINE_IMAGE_BYTES) {
      await safeDeleteStorage(ctx, args.storageId);
      throw new ConvexError(
        `cover image exceeds maximum size of ${MAX_INLINE_IMAGE_BYTES} bytes (got ${meta.size})`,
      );
    }

    const existing = await ctx.db.query("coverImageOwnership").…;
    if (existing) return null;
    await ctx.db.insert("coverImageOwnership", { storageId, userId, createdAt });
    return null;
  },
});
```

Apply the same MIME tightening to `claimCoverVideoPosterOwnership` (lines 765-770).

- **Effort:** Small
- **Risk:** Low (defensive validation only — happy paths unaffected because client picker already enforces these MIME types)

## Implementation Steps

1. In `mutations.ts`, add the metadata read + MIME + size validation to `claimCoverImageOwnership`.
2. Replace the `startsWith('image/')` check in `claimCoverVideoPosterOwnership` with `ALLOWED_INLINE_IMAGE_TYPES.has(contentType)`.
3. Add convex-test cases for both: SVG rejection, oversized rejection, blob-deleted-on-reject. (As with FG_175, MIME-reject in convex-test may be untestable due to contentType preservation — exercise via e2e instead if so.)
4. Run `pnpm --filter=@feel-good/convex test` and `pnpm --filter=@feel-good/mirror test:e2e -- article-cover-video` (which should still pass since the picker only offers PNG/JPEG/WEBP).
5. Run `pnpm --filter=@feel-good/mirror lint && pnpm --filter=@feel-good/mirror build`.

## Constraints

- Existing valid uploads (PNG/JPEG/WEBP under 5 MiB) must continue to claim successfully — the picker enforces these MIME types client-side.
- Rejected blobs must be deleted via `safeDeleteStorage` to avoid `_storage` accumulation.

## Resources

- Source: `packages/convex/convex/articles/mutations.ts:646-669,752-791`
- Policy: `packages/convex/convex/content/storagePolicy.ts:31-35` `ALLOWED_INLINE_IMAGE_TYPES`
- Reference: `claimCoverVideoOwnership` (lines 704-744) is the canonical shape.
