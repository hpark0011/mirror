---
id: FG_171
title: "deleteOrphanCoverVideo and deleteOrphanCoverImage must use withIndex instead of filter"
date: 2026-05-08
type: refactor
status: canceled
priority: p1
description: "Both orphan-cleanup mutations use full-table .filter() scans on the articles table. This violates the Convex query guideline (use withIndex), and at the per-transaction read cap a malformed scan could cause a referenced blob to be incorrectly deleted via safeDeleteStorage's silent error swallow."
dependencies: ["FG_167"]
parent_plan_id: PLAN_010
acceptance_criteria:
  - "`grep -n '.filter((q) => q.eq(q.field' packages/convex/convex/articles/mutations.ts` returns zero matches inside deleteOrphanCoverVideo and deleteOrphanCoverImage"
  - "`grep -n 'by_coverVideoStorageId\\|by_coverVideoPosterStorageId\\|by_coverImageStorageId' packages/convex/convex/articles/schema.ts` shows the three new indexes on articlesTable"
  - "`pnpm --filter=@feel-good/convex test` passes including the existing orphan-delete unit tests"
  - "`pnpm --filter=@feel-good/mirror lint` exits 0"
owner_agent: "Convex Backend Engineer"
---

# deleteOrphanCoverVideo and deleteOrphanCoverImage Must Use withIndex Instead of Filter

## Context

`deleteOrphanCoverVideo` (`packages/convex/convex/articles/mutations.ts:858-887`) introduces two new full-table scans on `articles`:

```ts
.query("articles").filter((q) => q.eq(q.field("coverVideoStorageId"), args.videoStorageId)).first()
.query("articles").filter((q) => q.eq(q.field("coverVideoPosterStorageId"), args.posterStorageId)).first()
```

Pre-existing `deleteOrphanCoverImage` (lines 807-835) has the same shape on `coverImageStorageId`. Direct violation of `.claude/rules/convex.md` query guideline ("Do NOT use `filter` in queries; use `withIndex`").

Beyond the rule violation, there's a correctness risk: if the `articles` table grows past Convex's per-transaction read cap (~16,384 documents at default), the scan throws. The handler reads `if (referencingVideo === null)` and proceeds to `safeDeleteStorage` — and `safeDeleteStorage` swallows errors silently — meaning a referenced blob could be deleted because the scan never completed.

- **Source:** Code review of PLAN_010 article-cover-video branch
- **Location:** `packages/convex/convex/articles/mutations.ts:861, 875` (video) and `:818` (image)
- **Evidence:** Schema has no index on `coverImageStorageId`, `coverVideoStorageId`, or `coverVideoPosterStorageId`.

## Goal

All orphan-cleanup reference scans run via `withIndex`, eliminating both the rule violation and the scan-fails-silently correctness risk. Schema is the canonical source for these reverse-lookup paths.

## Scope

- Add three indexes to `articlesTable` in `packages/convex/convex/articles/schema.ts`: `by_coverImageStorageId`, `by_coverVideoStorageId`, `by_coverVideoPosterStorageId`.
- Replace the `.filter()` calls in `deleteOrphanCoverVideo` and `deleteOrphanCoverImage` with `.withIndex(...)` lookups.

## Out of Scope

- Switching the orphan-cleanup mutations to consult `STORAGE_FIELD_REFERENCES` (FG_194 — separate concern).
- Adding indexes for posts cover fields (those are not on the orphan-cleanup hot path).
- Migrating existing data — index additions are non-breaking on Convex.

## Approach

Schema additions:
```ts
export const articlesTable = defineTable(articleFields)
  .index("by_userId", ["userId"])
  …
  .index("by_coverImageStorageId", ["coverImageStorageId"])
  .index("by_coverVideoStorageId", ["coverVideoStorageId"])
  .index("by_coverVideoPosterStorageId", ["coverVideoPosterStorageId"]);
```

Mutation updates:
```ts
const referencingVideo = await ctx.db
  .query("articles")
  .withIndex("by_coverVideoStorageId", (q) => q.eq("coverVideoStorageId", args.videoStorageId))
  .first();
```

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. In `packages/convex/convex/articles/schema.ts`, add the three indexes to `articlesTable`.
2. In `mutations.ts`, replace the two `.filter()` calls in `deleteOrphanCoverVideo` with `.withIndex()` lookups.
3. Replace the `.filter()` call in `deleteOrphanCoverImage` with the same.
4. Run `pnpm --filter=@feel-good/convex exec convex dev --once` to push the schema and confirm the indexes build.
5. Run `pnpm --filter=@feel-good/convex test` — existing tests should still pass.
6. Run `pnpm --filter=@feel-good/mirror lint && pnpm --filter=@feel-good/mirror build`.

## Constraints

- Index additions on existing optional fields are non-breaking — Convex tolerates them on existing rows.
- This change pairs with FG_167 (caller-ownership check) — order doesn't matter, but both should land before merge.
- Coordinate with FG_194 (registry-driven sweep) — that ticket is the larger refactor; this ticket is the targeted rule-compliance fix.

## Resources

- Rule: `.claude/rules/convex.md` § Query guidelines
- Source: `packages/convex/convex/articles/mutations.ts:807-887`

## Resolution

Canceled as a standalone index-change ticket on 2026-05-08. FG_194 replaced the hardcoded orphan reference scans with the shared storage registry, so the `.filter()` violation is gone without adding one-off cover-field indexes.
