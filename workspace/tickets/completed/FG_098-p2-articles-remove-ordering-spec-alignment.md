---
id: FG_098
title: "articles.remove cover-delete ordering matches the spec or the spec is updated"
date: 2026-05-02
type: refactor
status: completed
priority: p2
description: "Spec FR-06 says 'cover-image ordering for articles is NOT changed by this spec'. The implementation in articles/mutations.ts remove DID change ordering — cover delete now runs AFTER ctx.db.delete (matching the inline-image cascade pattern), where it used to run BEFORE. The new ordering is actually safer (cron sweep handles a failed cover delete vs. leaving a live row pointing at a missing asset). Decide policy: either restore the original ordering for articles.remove, or update the spec to acknowledge that the carve-out was intentionally closed for this surface too."
dependencies: []
parent_plan_id: workspace/spec/2026-04-30-tiptap-inline-image-lifecycle-spec.md
acceptance_criteria:
  - "Either: spec workspace/spec/2026-04-30-tiptap-inline-image-lifecycle-spec.md is updated to acknowledge articles.remove ordering changed and removes the 'NOT changed' language for the remove path; OR articles/mutations.ts remove handler is restored to delete cover blob BEFORE ctx.db.delete"
  - "If spec is updated: grep -n 'cover-image ordering' workspace/spec/2026-04-30-tiptap-inline-image-lifecycle-spec.md returns the updated language"
  - "If code is restored: ctx.storage.delete(article.coverImageStorageId) appears BEFORE ctx.db.delete in articles/mutations.ts remove"
  - "Existing mutations.test.ts cases for articles.remove cover-image cascade still pass"
  - "pnpm --filter=@feel-good/convex test passes"
owner_agent: "Convex backend / spec custodian"
---

# articles.remove cover-delete ordering matches the spec or the spec is updated

## Context

ce:review (`feature-add-editor`, 2026-05-02) Finding #10, api-contract reviewer at confidence 0.80. Spec FR-06 says:

> Cover-image ordering for articles is NOT changed by this spec — the existing delete-before-patch behavior in `articles/mutations.ts:129-136` stays as-is to avoid unrelated test churn.

The implementation in `articles/mutations.ts:260-266` (current HEAD):

```ts
await ctx.db.delete(article._id);

// Delete cover after the row is gone so a failed delete can't leave a
// live article pointing at a missing asset.
if (article.coverImageStorageId) {
  await ctx.storage.delete(article.coverImageStorageId);
}
```

This is the *new* ordering — `db.delete` first, then cover delete. The diff against BASE confirms the lines moved. The new ordering is reliability-better (matches the inline-image cascade and posts.remove pattern), but it contradicts the spec's "NOT changed" commitment.

This isn't a bug — it's a docs vs code disagreement. Pick a side.

## Goal

After this ticket, the spec language and `articles.remove` implementation agree on cover-delete ordering. Either the spec acknowledges the change (preferred, since the new ordering is safer), or the code is reverted.

## Scope

- `workspace/spec/2026-04-30-tiptap-inline-image-lifecycle-spec.md` — update FR-06 carve-out language.
- OR `packages/convex/convex/articles/mutations.ts` remove handler — restore original ordering.
- Tests aligned with whichever decision wins.

## Out of Scope

- The `update` cover-delete ordering — that's FG_097's territory.
- Posts.remove — unchanged and correct.

## Approach

Recommended: update the spec. The new ordering matches `posts.remove` and prevents the "live row points to deleted blob" failure mode. Reverting would re-introduce the inconsistency.

If reverting is preferred (e.g., to honor the spec's "no test churn" commitment), the change is mechanical: move the `if (article.coverImageStorageId)` block back above `await ctx.db.delete(article._id)`.

- **Effort:** Small (either path)
- **Risk:** Low — limited blast radius

## Implementation Steps

**Spec-update path (recommended):**

1. Edit `workspace/spec/2026-04-30-tiptap-inline-image-lifecycle-spec.md` FR-06 carve-out language. Replace "Cover-image ordering for articles is NOT changed by this spec" with: "Cover-image ordering for articles.remove was changed to match posts.remove (delete-after-db.delete), aligning with the inline-image cascade. articles.update preserves the legacy delete-before-patch ordering pending FG_097."
2. Run `pnpm --filter=@feel-good/convex test` — confirm no regression.
3. Run `pnpm --filter=@feel-good/mirror build`.

**Code-revert path (if spec stays):**

1. In `packages/convex/convex/articles/mutations.ts` `remove` handler, move the cover-delete block back above `await ctx.db.delete(article._id)`.
2. Update or remove the comment that says "Delete cover after the row is gone..."
3. Run tests — confirm any tests that depend on the new ordering are updated.
4. Run build.

## Constraints

- Whichever path wins, the inline-image cascade ordering (after `db.delete`) stays as-is.
- Both paths must keep the cover-delete inside the `for (const article of owned)` loop — bulk removes still need to delete each article's cover.

## Resources

- ce:review run artifact: `.context/compound-engineering/ce-review/2026-05-02-feature-add-editor/findings.md` Finding #10.
- `workspace/spec/2026-04-30-tiptap-inline-image-lifecycle-spec.md` FR-06 — current "NOT changed" language.
- `packages/convex/convex/articles/mutations.ts:252-266` — the remove handler in question.
- `packages/convex/convex/posts/mutations.ts:262-276` — the reference correct ordering.
