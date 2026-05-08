---
id: FG_196
title: "Add kind discriminator to coverImageOwnership table"
date: 2026-05-08
type: refactor
status: to-do
priority: p3
description: "Three blob kinds (image, video, poster) share one ownership table with no kind field. Future queries that need to enumerate by kind cannot. Combined with FG_181 (kind-blind assertion) this is the structural debt that makes the security gap possible."
dependencies: []
parent_plan_id: PLAN_010
acceptance_criteria:
  - "coverImageOwnershipFields includes `kind: v.union(v.literal('image'), v.literal('video'), v.literal('poster'))`"
  - "A backfill internalMutation sets kind='image' on every existing row"
  - "All three claim mutations insert `kind` matching their purpose"
  - "`pnpm --filter=@feel-good/convex test` passes including a new test asserting each claim mutation writes the correct kind"
owner_agent: "Convex Backend Engineer"
---

# Add Kind Discriminator to coverImageOwnership Table

## Context

The `coverImageOwnership` table (`packages/convex/convex/articles/schema.ts:58-66`) stores ownership rows for three different blob kinds: cover image, cover video, and cover video poster. The schema has no `kind` field — all three claim mutations insert into the same table with the same shape.

Without a `kind` discriminator:
- `assertCoverBlobOwnership` cannot distinguish a poster-claim from an image-claim → security gap (FG_181)
- Future queries that need "list all video covers owned by user X" cannot be expressed
- Sweeping ownership rows during their cleanup (FG_179) would benefit from kind-typed queries
- Cross-kind blob reuse is structurally possible

This ticket adds the field and the backfill. FG_181 consumes the field at the assertion boundary.

- **Source:** Code review of PLAN_010 article-cover-video branch
- **Location:** `packages/convex/convex/articles/schema.ts:58-66`
- **Evidence:** Schema has no `kind` field; mutations insert with no discriminant.

## Goal

`coverImageOwnership` rows carry a `kind` discriminator, enabling per-kind queries and per-kind ownership assertions.

## Scope

- Add `kind` to the table schema (required field, three literals).
- Write a one-time backfill mutation that sets `kind='image'` on existing rows.
- Update each claim mutation to set `kind` on insert.
- Update validators / types as needed.

## Out of Scope

- Updating `assertCoverBlobOwnership` to consume the field (FG_181).
- Renaming the table to `coverBlobOwnership` (out of scope; not currently ticketed).
- Per-kind size/MIME tightening (FG_182).

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

Convex requires schema changes to be compatible with existing data. Add the field as `v.optional(...)` first, deploy the backfill, then tighten to required in a follow-up deploy. The widen → backfill → narrow path is the only safe option for any populated deployment: Convex rejects a deploy where existing rows would fail the new required field's validator, so adding `kind` as required up front is not a viable alternative.

Backfill (using the @convex-dev/migrations pattern):
```ts
// migrations/setKindOnExistingCoverOwnership.ts
export const setKindOnExistingCoverOwnership = internalMutation({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const { page, isDone, continueCursor } = await ctx.db
      .query("coverImageOwnership")
      .filter((q) => q.eq(q.field("kind"), undefined))
      .paginate(paginationOpts);
    for (const row of page) await ctx.db.patch(row._id, { kind: "image" });
    return { isDone, continueCursor };
  },
});
```

Claim mutations: insert `kind: 'image' | 'video' | 'poster'` matching the mutation's purpose.

- **Effort:** Medium
- **Risk:** Medium (schema migration)

## Implementation Steps

1. Add `kind: v.optional(...)` to `coverImageOwnershipFields` in `schema.ts`.
2. Update each claim mutation to insert the matching kind value.
3. Write the backfill mutation in `packages/convex/convex/migrations/`.
4. Run the backfill: `pnpm --filter=@feel-good/convex exec convex run migrations:setKindOnExistingCoverOwnership`.
5. Once backfill is complete (paginate to `isDone`), tighten the schema field from `v.optional` to required and re-run `convex dev --once`.
6. Add unit tests asserting each claim mutation writes the correct kind.
7. Run `pnpm --filter=@feel-good/convex test`.
8. Coordinate with FG_181 — that ticket consumes the new field at the assertion boundary.

## Constraints

- Schema migration must be widen-migrate-narrow per `.claude/rules/convex-migration-helper` if applicable.
- Existing rows must keep working through both phases — optional field accepted during backfill, required after.

## Resources

- `convex-migration-helper` skill
- Source: `packages/convex/convex/articles/schema.ts:58-66` and the three claim mutations
- Related: FG_181 (consumer of the new `kind` field at the assertion boundary)
