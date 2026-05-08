---
id: FG_194
title: "deleteOrphanCoverVideo and deleteOrphanCoverImage should consult STORAGE_FIELD_REFERENCES"
date: 2026-05-08
type: refactor
status: to-do
priority: p3
description: "Both orphan-cleanup mutations hardcode articles-only scans instead of using collectReferencedFromCandidates from storageRegistry.ts. No live bug today, but a future schema change adding video references to posts/users would silently delete blobs the new table references."
dependencies: ["FG_171"]
parent_plan_id: PLAN_010
acceptance_criteria:
  - "deleteOrphanCoverVideo replaces its two .filter() / .withIndex() scans with a single call to collectReferencedFromCandidates(ctx, [args.videoStorageId, args.posterStorageId])"
  - "deleteOrphanCoverImage applies the same refactor for parity"
  - "`pnpm --filter=@feel-good/convex test` passes including the existing orphan-delete tests"
  - "`pnpm --filter=@feel-good/mirror lint && pnpm --filter=@feel-good/mirror build` exit 0"
owner_agent: "Convex Backend Engineer"
---

# deleteOrphanCoverVideo and deleteOrphanCoverImage Should Consult STORAGE_FIELD_REFERENCES

## Context

`deleteOrphanCoverVideo` (`packages/convex/convex/articles/mutations.ts:858-887`) hardcodes scans on the `articles` table:

```ts
const referencingVideo = await ctx.db
  .query("articles")
  .filter((q) => q.eq(q.field("coverVideoStorageId"), args.videoStorageId))
  .first();
```

The same pattern exists for `coverVideoPosterStorageId` and in pre-existing `deleteOrphanCoverImage`. Meanwhile, `STORAGE_FIELD_REFERENCES` (in `packages/convex/convex/content/storageRegistry.ts:47-97`) is the canonical list of every table+field that holds a `_storage` reference, and `collectReferencedFromCandidates` is the helper that walks every entry and returns the subset of candidates that are referenced.

The cron sweep already uses `collectReferencedFromCandidates`. The orphan-cleanup mutations should too — for two reasons:

1. **Future-safety:** if a future schema change adds `coverVideoStorageId` to `posts` or `users`, `STORAGE_FIELD_REFERENCES` gets updated (the schema-introspection regression test enforces it). The cron sweep would automatically respect the new reference. The hardcoded `deleteOrphanCoverVideo` scans would not, and could silently delete blobs the new table references.

2. **Single source of truth:** maintenance hazard reduced. Adding a new cover-blob field requires touching exactly one place (the registry), not "registry + every orphan-delete mutation."

This ticket assumes FG_171 has landed (which adds proper indexes for the existing scans). After FG_171, the two `.filter()` calls become `.withIndex()` calls. After this ticket, both calls collapse into a single `collectReferencedFromCandidates` call that walks the registry.

- **Source:** Code review of PLAN_010 article-cover-video branch
- **Location:** `packages/convex/convex/articles/mutations.ts:858-887` (video) and `:807-835` (image)
- **Evidence:** Hardcoded `articles`-only scan vs. registry-driven `collectReferencedFromCandidates`.

## Goal

Both orphan-cleanup mutations rely on `STORAGE_FIELD_REFERENCES` so adding a new cover-storage-id field anywhere only needs to touch one place.

## Scope

- Replace the two scans in `deleteOrphanCoverVideo` with a single `collectReferencedFromCandidates` call.
- Apply the same refactor to `deleteOrphanCoverImage`.
- Remove the cover-storage-id indexes added by FG_171 if they're no longer used by anything else (verify before removing).

## Out of Scope

- Refactoring the orphan-sweep cron (already uses the registry).
- Adding new tables to the registry.

## Approach

```ts
import { collectReferencedFromCandidates } from "../content/storageRegistry";

export const deleteOrphanCoverVideo = authMutation({
  args: { videoStorageId: v.optional(v.id("_storage")), posterStorageId: v.optional(v.id("_storage")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.videoStorageId === undefined && args.posterStorageId === undefined) return null;
    const candidates = [
      ...(args.videoStorageId ? [args.videoStorageId] : []),
      ...(args.posterStorageId ? [args.posterStorageId] : []),
    ];
    const referenced = await collectReferencedFromCandidates(ctx, candidates);
    for (const id of candidates) {
      if (!referenced.has(id)) {
        await safeDeleteStorage(ctx, id);
      }
    }
    return null;
  },
});
```

- **Effort:** Small
- **Risk:** Low (registry already in use)

## Implementation Steps

1. After FG_171 lands (provides indexes the registry helper uses), update `deleteOrphanCoverVideo` to use `collectReferencedFromCandidates`.
2. Apply the same refactor to `deleteOrphanCoverImage`.
3. Confirm the existing orphan-delete unit tests still pass.
4. Verify the cover-storage-id indexes are still used elsewhere (they may be — query planner may still benefit). Don't remove without grep-checking.
5. Run `pnpm --filter=@feel-good/convex test`.
6. Run `pnpm --filter=@feel-good/mirror lint && pnpm --filter=@feel-good/mirror build`.

## Constraints

- The registry helper `collectReferencedFromCandidates` does a full table scan per registered table. For large tables this may be slower than a single indexed scan — measure before merge.
- If FG_167 (caller-ownership check) is in place, that gate fires first and short-circuits before this scan runs.

## Resources

- Source: `packages/convex/convex/articles/mutations.ts:846-887`
- Helper: `packages/convex/convex/content/storageRegistry.ts:142-167`
- Cron usage: `packages/convex/convex/crons.ts` (uses `collectReferencedFromCandidates` / `buildReferencedStorageSet`)
