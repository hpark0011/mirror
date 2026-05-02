---
id: FG_102
title: "sweepOrphanedStorage computes the referenced-set once per run, not per page"
date: 2026-05-02
type: perf
status: to-do
priority: p2
description: "buildReferencedStorageSet runs ctx.db.query('articles').collect() and posts/users equivalents on every paginated sweep page. The referenced-set is invariant across pages within a single sweep run — recomputing it P times is wasted work. Compute on the first invocation, serialize into the scheduler.runAfter args for continuation pages, and pass it forward."
dependencies: []
parent_plan_id: workspace/spec/2026-04-30-tiptap-inline-image-lifecycle-spec.md
acceptance_criteria:
  - "sweepOrphanedStorage handler computes buildReferencedStorageSet only when args.referencedIds is undefined (first page); subsequent pages receive it via scheduler args"
  - "The cron's args validator includes an optional referencedIds: v.optional(v.array(v.string())) field"
  - "ctx.scheduler.runAfter call for continuation pages passes both cursor AND referencedIds from the current invocation"
  - "Existing FR-10 sweep tests (single-page deletion, grace-window survival, referenced-set-skips) all pass unchanged"
  - "New Vitest: 500-orphan multi-page sweep — assert table-collect calls happen exactly once across all pages (mock or spy on ctx.db.query)"
  - "pnpm --filter=@feel-good/convex test passes"
owner_agent: "Convex performance specialist"
---

# sweepOrphanedStorage computes the referenced-set once per run, not per page

## Context

ce:review (`feature-add-editor`, 2026-05-02) Finding #16, performance reviewer at confidence 0.82.

`packages/convex/convex/crons.ts:160-195` `sweepOrphanedStorage`:

```ts
handler: async (ctx, args) => {
  const cutoff = Date.now() - ORPHAN_GRACE_MS;
  const page = await ctx.db.system.query("_storage")...;
  const referenced = await buildReferencedStorageSet(ctx);    // <-- runs every page
  // ... delete loop ...
  if (!page.isDone) {
    await ctx.scheduler.runAfter(0, internal.crons.sweepOrphanedStorage, {
      cursor: page.continueCursor,
    });
  }
}
```

`buildReferencedStorageSet` (lines 125-149) runs `ctx.db.query("articles").collect()`, `posts.collect()`, and `users.collect()`. With P paginated `_storage` pages and stable article/post counts, the article and post tables are fully scanned P times per sweep run. At today's <1000-article personal-blogging scope this is fine; the latent bug is that as `_storage` accrues (many uploaded-then-deleted images), P grows while article/post counts don't, multiplying unnecessary reads.

The referenced-set is invariant across pages within a single sweep run (no schema mutations land between pages). Computing once and passing forward is always safe.

## Goal

After this ticket, a single sweep run computes the referenced-set exactly once. Across P storage pages, only one full table scan of articles, posts, and users happens.

## Scope

- `packages/convex/convex/crons.ts` `sweepOrphanedStorage` — accept optional `referencedIds` arg, compute on first call, pass forward.
- Update args validator.
- Pass `referencedIds` in the `ctx.scheduler.runAfter` continuation call.
- Tests confirming the optimization.

## Out of Scope

- Pagination of the article/post full-table walk (NFR-02 documents this is unbounded; future ticket if scope grows).
- Caching the referenced-set across separate sweep runs (would require a system table or cache).

## Approach

```ts
export const sweepOrphanedStorage = internalMutation({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
    referencedIds: v.optional(v.array(v.string())),
  },
  returns: { ... },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - ORPHAN_GRACE_MS;
    const page = await ctx.db.system.query("_storage")...;

    // Compute referenced-set on first invocation; reuse on continuations.
    const referenced = args.referencedIds
      ? new Set(args.referencedIds)
      : await buildReferencedStorageSet(ctx);

    let deleted = 0;
    for (const entry of page.page) { ... }   // existing delete loop with try/catch from FG_004

    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.crons.sweepOrphanedStorage, {
        cursor: page.continueCursor,
        referencedIds: Array.from(referenced),
      });
    }

    return { deleted, scanned: page.page.length, isDone: page.isDone };
  },
});
```

The serialized array of strings is bounded by the total referenced-blob count. For <1000 articles + posts + users with average 5 inline images each, this is ~5000 strings → tens of KB per scheduler call. Fits within Convex's mutation arg limits.

- **Effort:** Small
- **Risk:** Low — backwards-compatible (existing single-call usage where args.referencedIds is undefined still works).

## Implementation Steps

1. Update args validator in `packages/convex/convex/crons.ts` `sweepOrphanedStorage` to accept optional `referencedIds: v.optional(v.array(v.string()))`.
2. Inside the handler, compute `referenced` from args if present, else from `buildReferencedStorageSet(ctx)`.
3. Update the `ctx.scheduler.runAfter` continuation call to include `referencedIds: Array.from(referenced)`.
4. Add a test in `packages/convex/convex/content/__tests__/orphan-sweep.test.ts` that spies on `ctx.db.query("articles").collect()` (e.g., via vi.fn wrapping) and asserts it's called exactly once across a multi-page sweep.
5. Verify all existing sweep tests still pass.
6. Run `pnpm --filter=@feel-good/convex test` and `pnpm --filter=@feel-good/mirror build`.

## Constraints

- The schema-introspection regression test (`STORAGE_FIELD_REFERENCES`) is unaffected; this ticket changes only the runtime computation.
- Continuation pages must receive the SAME referenced-set the first page used — even if articles/posts were inserted/deleted mid-sweep, the first-page snapshot wins.
- The arg shape change is additive; existing schedulers continue to call with `{ cursor }` only.

## Resources

- ce:review run artifact: `.context/compound-engineering/ce-review/2026-05-02-feature-add-editor/findings.md` Finding #16.
- `packages/convex/convex/crons.ts:125-195` — the implementation site.
- Spec NFR-02 — pagination contract.
