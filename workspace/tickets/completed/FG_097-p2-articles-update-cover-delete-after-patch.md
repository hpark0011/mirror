---
id: FG_097
title: "articles.update deletes the previous cover blob after the DB patch succeeds"
date: 2026-05-02
type: fix
status: completed
priority: p2
description: "articles/mutations.ts update mutation deletes article.coverImageStorageId BEFORE ctx.db.patch. Convex storage operations are NOT part of the mutation transaction — if ctx.db.patch later fails (OCC conflict, validator throw), Convex rolls back the DB but cannot reverse the storage delete. Result: the article still references the old coverImageStorageId in the DB, but the blob is gone, and the cover renders broken. posts/mutations.ts already deletes after patch — articles is the outlier (a deliberate carve-out per FR-06). This ticket closes the carve-out."
dependencies: []
parent_plan_id: workspace/spec/2026-04-30-tiptap-inline-image-lifecycle-spec.md
acceptance_criteria:
  - "In packages/convex/convex/articles/mutations.ts, the line ctx.storage.delete(article.coverImageStorageId) appears AFTER the ctx.db.patch(args.id, patch) call"
  - "Existing inline-image deletion ordering for articles.update remains: ctx.db.patch first, inline ctx.storage.delete loop after"
  - "Existing mutations.test.ts cases that assert cover-image replacement behavior continue to pass (or are updated together with the ordering fix)"
  - "pnpm --filter=@feel-good/convex test passes (full suite)"
  - "pnpm --filter=@feel-good/mirror build passes"
owner_agent: "Convex backend specialist"
---

# articles.update deletes the previous cover blob after the DB patch succeeds

## Context

ce:review (`feature-add-editor`, 2026-05-02) Finding #9, adversarial reviewer at confidence 0.78. The bug:

`packages/convex/convex/articles/mutations.ts:142-148` deletes the previous cover blob *before* `ctx.db.patch` at line 199:

```ts
if (
  args.coverImageStorageId !== undefined &&
  args.coverImageStorageId !== article.coverImageStorageId &&
  article.coverImageStorageId
) {
  await ctx.storage.delete(article.coverImageStorageId);
}
// ... 50 lines later ...
await ctx.db.patch(args.id, patch);
```

If `ctx.db.patch` throws (OCC conflict from a concurrent update, validator failure, downstream constraint), the mutation transaction rolls back the DB write. But `ctx.storage.delete` is NOT part of the transaction — Convex storage operations are not transactional. The article row in the DB still references the now-deleted `article.coverImageStorageId`, and `ctx.storage.getUrl(coverImageStorageId)` returns null. The cover image renders as broken.

`packages/convex/convex/posts/mutations.ts:201-209` correctly performs the cover delete *after* the patch. The articles inconsistency was preserved as an explicit carve-out in FR-06 ("would risk breaking existing mutations.test.ts"). Time to address it properly.

## Goal

After this ticket, articles.update follows the same delete-after-patch pattern as posts.update. A failed patch no longer leaves the article pointing at a deleted blob.

## Scope

- `packages/convex/convex/articles/mutations.ts` `update` handler — move cover-delete after `ctx.db.patch`.
- Update or replace any `mutations.test.ts` assertions that depend on the old ordering.
- Wrap the delete in try/catch matching the pattern of inline-image deletes in `update` (already applied as part of FG_008).

## Out of Scope

- Changing the `remove` ordering — that's separate (and already changed in this branch — see FG_098).
- Cover-image attribute schema changes.
- Posts-side ordering — already correct.

## Approach

Move lines 142-148 to right after `ctx.db.patch(args.id, patch)` at line 199. Wrap in try/catch so a failed delete (e.g., blob already gone) doesn't roll back the patch we just committed:

```ts
await ctx.db.patch(args.id, patch);

// After the patch succeeds, delete the previous cover blob if it was
// replaced. ctx.storage.delete is not transactional, so a failure here
// must not roll back the patch above.
if (
  args.coverImageStorageId !== undefined &&
  args.coverImageStorageId !== article.coverImageStorageId &&
  article.coverImageStorageId
) {
  try {
    await ctx.storage.delete(article.coverImageStorageId);
  } catch {
    // Cron sweep is the safety net.
  }
}

// ... existing inline-image delete loop continues here ...
```

- **Effort:** Small
- **Risk:** Low — purely an ordering fix; covered by existing tests once they're updated to match the new ordering.

## Implementation Steps

1. In `packages/convex/convex/articles/mutations.ts` `update` handler, cut the cover-delete block at lines 142-148 and paste it after the `await ctx.db.patch(args.id, patch);` call (around line 199).
2. Wrap the `await ctx.storage.delete(article.coverImageStorageId)` call in try/catch with a "cron sweep is the safety net" comment.
3. Remove the old "NOTE: cover-image delete-before-patch ordering is preserved as-is per FR-06" comment.
4. Run `pnpm --filter=@feel-good/convex test`. If `mutations.test.ts` cover-image cases fail, update the assertions to match the new delete-after-patch ordering.
5. Re-run the full convex test suite.
6. Run `pnpm --filter=@feel-good/mirror build`.

## Constraints

- The mutation must remain a single transaction for the DB patch — only the storage operation moves.
- If both cover and inline-image deletes happen on the same update, both must run after the patch.
- If `mutations.test.ts` asserts the order of `ctx.storage.delete` calls strictly, those assertions must be reviewed and possibly relaxed (deletes are now sequential after the patch, not interleaved).

## Resources

- ce:review run artifact: `.context/compound-engineering/ce-review/2026-05-02-feature-add-editor/findings.md` Finding #9.
- Spec FR-06 carve-out (will need an addendum noting the carve-out was closed).
- `packages/convex/convex/posts/mutations.ts:201-209` — reference for the correct ordering.
