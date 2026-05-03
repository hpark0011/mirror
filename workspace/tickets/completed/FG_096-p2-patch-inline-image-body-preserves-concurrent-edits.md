---
id: FG_096
title: "_patchInlineImageBody preserves concurrent body edits during markdown import"
date: 2026-05-02
type: fix
status: completed
priority: p2
description: "importMarkdownInlineImages reads the article/post body in transaction 1, performs N external fetches that can take up to 10 seconds each, then patches the body in transaction 2. If the user edits the body between the read and the patch, those edits are silently overwritten with the action's stale version. There is no version check, no merge, no conflict signal — just last-write-wins. Replace the wholesale body replacement with a merge that only updates image-node src/storageId on already-existing image nodes."
dependencies: [FG_095]
parent_plan_id: workspace/spec/2026-04-30-tiptap-inline-image-lifecycle-spec.md
acceptance_criteria:
  - "grep -A 20 'export const _patchInlineImageBody' packages/convex/convex/articles/internalImages.ts shows a merge step (re-reads current body, only updates image src+storageId) — not a wholesale ctx.db.patch with args.body"
  - "Same in packages/convex/convex/posts/internalImages.ts"
  - "New Vitest case: read body, edit body via update mutation, then call _patchInlineImageBody with the stale body — assert the user's edits survive and only the image-node src/storageId fields update"
  - "Existing FR-08 import tests still pass"
  - "pnpm --filter=@feel-good/convex test passes"
  - "pnpm --filter=@feel-good/mirror build passes"
owner_agent: "Convex backend / concurrency specialist"
---

# _patchInlineImageBody preserves concurrent body edits during markdown import

## Context

ce:review (`feature-add-editor`, 2026-05-02) Finding #7, reliability reviewer at confidence 0.85. The race:

1. `importMarkdownInlineImages` action reads body via `_readArticleBody` internal query at `articles/actions.ts:54-57`. This is transaction 1.
2. The action then calls `safeFetchImage` for each external image — N×up-to-10s of network I/O.
3. The action calls `_patchInlineImageBody` internal mutation at `articles/actions.ts:116-119` (transaction 2). This is `ctx.db.patch(args.articleId, { body: args.body })` at `articles/internalImages.ts:33` — a wholesale body replace.
4. If the user edited the body between step 1 and step 3 (e.g., added a paragraph, removed a different image), their edit is lost.

The same pattern exists in `posts/internalImages.ts:33`.

The window is bounded but realistic: 5 images × 5s avg fetch = 25s where the user might still be typing. With FG_101 (cap N) the worst case is shorter, but the race remains.

## Goal

After this ticket, concurrent user edits to the body during markdown import are not silently overwritten. The action's writes are scoped to image-node src/storageId fields on the nodes it already processed, applied as a merge against the current body.

## Scope

- `packages/convex/convex/articles/internalImages.ts` `_patchInlineImageBody` — re-read current body and merge image-node updates.
- `packages/convex/convex/posts/internalImages.ts` `_patchInlineImageBody` — same.
- Vitest case in both `__tests__/inline-images.test.ts` files demonstrating the merge.

## Out of Scope

- Adding optimistic concurrency / version tokens — too invasive for this surface.
- Conflict-detection UI surfacing — the merge is silent and good enough since the action only ever wants to set `src` and `storageId`.
- Markdown-import retry idempotency (advisory in review) — separate concern.

## Approach

Replace the wholesale patch with a merge:

```ts
// _patchInlineImageBody pseudo-code
const current = await ctx.db.get(args.articleId);
if (!current) return null;
const merged = mapInlineImages(current.body, (attrs) => {
  // For each image node currently in the body, look up if the action
  // produced a new src+storageId for the original src — if so, apply.
  // The action passes a srcMap: Record<originalSrc, { src, storageId }>.
  if (typeof attrs.src !== "string") return attrs;
  const update = args.srcMap[attrs.src];
  if (!update) return attrs;
  return { ...attrs, src: update.src, storageId: update.storageId };
});
await ctx.db.patch(args.articleId, { body: merged });
```

This requires changing the mutation arg shape from `body: v.any()` to `srcMap: v.record(v.string(), v.object({ src: v.string(), storageId: v.id("_storage") }))`. The action builds the srcMap from its `resolved` Map and passes it instead of the rewritten body.

Side benefit: the wire payload shrinks (a few storageId mappings vs. a whole body tree).

- **Effort:** Medium
- **Risk:** Medium — changes the internal mutation contract; needs careful test coverage. Coordinate with FG_095 (markdown-import extraction) since both touch the same surface.

## Implementation Steps

1. Coordinate with FG_095 implementation order — prefer this ticket lands AFTER FG_095 so the merge logic can live in the shared helper.
2. Change `_patchInlineImageBody` arg validator to `{ articleId|postId, srcMap: v.record(v.string(), v.object({ src: v.string(), storageId: v.id("_storage") })) }`.
3. Inside the handler: re-read current body, apply `mapInlineImages` with the srcMap as the lookup, patch with the merged body.
4. Update the action handler (or the shared helper from FG_095) to build the srcMap from `resolved` and pass it.
5. Add Vitest case: simulate body edit between `_readBody` and `_patchInlineImageBody` (call them as separate steps), assert the user's intermediate edit survives.
6. Run all tests and build.

## Constraints

- The action's external return shape (`ImportResult`) must NOT change.
- Image nodes whose original `src` is no longer in the body (user removed them mid-import) must be silently skipped — already-stored blobs become orphans for the cron sweep.
- Image nodes that the user added during the race (with src not in the action's srcMap) must not be touched.

## Resources

- ce:review run artifact: `.context/compound-engineering/ce-review/2026-05-02-feature-add-editor/findings.md` Finding #7.
- `packages/convex/convex/articles/internalImages.ts:33` — the wholesale-patch site.
- `packages/convex/convex/content/body-walk.ts` `mapInlineImages` — the merge primitive.
