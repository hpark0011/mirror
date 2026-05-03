---
id: FG_115
title: "ImportResult counts rewritten image nodes, not unique URLs"
date: 2026-05-02
type: fix
status: completed
priority: p3
description: "ImportResult.imported = resolved.size and ImportResult.failed = failures.length. When a body contains three image nodes pointing to the same external URL, resolved.size is 1 even though three nodes were rewritten — the dialog says 'Imported 1 of 1' instead of 'Imported 3 of 3'. Conversely with the deduped tried-Set fix (FG_014), three failing duplicates count as 1 in failures, but the user sees three broken images. Track node count, not URL count, for user-facing reporting."
dependencies: [FG_095, FG_112]
parent_plan_id: workspace/spec/2026-04-30-tiptap-inline-image-lifecycle-spec.md
acceptance_criteria:
  - "ImportResult.imported counts image nodes whose src+storageId were rewritten in the body, not unique URLs that resolved"
  - "ImportResult.failed reflects the number of image nodes that were left unrewritten, not unique URL failures"
  - "ImportResult.failures still records distinct URL failures (one entry per URL), but with an occurrence count or affected node count if needed for clarity"
  - "New Vitest case: body with three image nodes pointing to the same successfully-imported URL — assert ImportResult.imported is 3 (or includes a node-count field that is 3)"
  - "Existing FR-08 import tests still pass"
  - "pnpm --filter=@feel-good/convex test passes"
owner_agent: "Convex backend specialist"
---

# ImportResult counts rewritten image nodes, not unique URLs

## Context

ce:review (`feature-add-editor`, 2026-05-02) Finding #38, correctness reviewer at confidence 0.88.

`packages/convex/convex/articles/actions.ts:121-125`:

```ts
return {
  imported: resolved.size,           // unique URLs successfully fetched
  failed: failures.length,           // unique URL failures (after FG_014's tried Set)
  failures,
};
```

Counts URLs, not nodes. Concrete cases:

- Body has 3 `<img src="https://x/y.png" />` nodes (same URL). The URL fetches successfully. After rewrite, all 3 nodes have the new Convex URL + storageId. But `resolved.size = 1`, so the dialog says "Imported 1 of 1." The user sees 3 working images and a misleading "1 imported" message.

- Body has 3 nodes with the same UNREACHABLE URL. After FG_014 the URL is fetched once and added to `failures`. `failures.length = 1`. The user sees 3 broken images and a "1 failed" message.

Decision: report node counts, not URL counts. URL failures (deduped) can stay in the `failures` array as URL-keyed but the `imported` / `failed` counts should reflect node impact.

## Goal

After this ticket, the markdown-upload dialog reports counts that match what the user sees in the rendered body. "Imported 5 of 6 images" means 5 nodes were rewritten and 1 was left unchanged.

## Scope

- Shared markdown-import helper (after FG_095) or both `actions.ts` files — track rewritten-node count and unrewritten-node count separately from unique URL counts.
- `ImportResult` shape: `imported` and `failed` reflect node counts; `failures` array entries can include `affectedNodes` count.

## Out of Scope

- Renaming `ImportResult` fields (would touch the dialog wiring).
- Showing per-node detail in the dialog UX.

## Approach

Track during the second pass (the body rewrite via `mapInlineImages`):

```ts
let rewrittenCount = 0;
let unrewrittenCount = 0;
const rewritten = mapInlineImages(body, (attrs) => {
  if (!attrs) return attrs;
  if (typeof attrs.storageId === "string" && attrs.storageId.length > 0) {
    return attrs; // already imported (idempotent path)
  }
  const src = attrs.src;
  if (typeof src !== "string" || !isAbsoluteHttpsUrl(src)) {
    return attrs;
  }
  const hit = resolved.get(src);
  if (hit) {
    rewrittenCount += 1;
    return { ...attrs, src: hit.src, storageId: hit.storageId };
  }
  unrewrittenCount += 1;
  return attrs;
});

return {
  imported: rewrittenCount,
  failed: unrewrittenCount,
  failures, // unchanged: per-URL entries
};
```

This makes `imported + failed` equal the count of external-URL image nodes processed. The `failures` array remains URL-keyed for informativeness.

- **Effort:** Small
- **Risk:** Low — additive accounting; surface remains backwards-compatible (just more accurate counts).

## Implementation Steps

1. Coordinate with FG_095 — implement in the shared helper.
2. Track `rewrittenCount` and `unrewrittenCount` during the `mapInlineImages` pass.
3. Replace `imported: resolved.size` and `failed: failures.length` with the node counts.
4. Add a Vitest case: body with 3 image nodes pointing to the same URL → `imported: 3` (when URL succeeds).
5. Run all tests.

## Constraints

- The `failures` array shape stays `{ src, reason }` — do not break existing dialog rendering.
- The validators on the action's return type may need updating if the shape changes.

## Resources

- ce:review run artifact: `.context/compound-engineering/ce-review/2026-05-02-feature-add-editor/findings.md` Finding #38.
- `packages/convex/convex/articles/actions.ts:99-125` and `posts/actions.ts` equivalent.
