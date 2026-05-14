---
id: FG_219
title: "queryProfileContentLibrary drops the synthetic _creationTime sort field"
date: 2026-05-14
type: refactor
status: completed
priority: p2
description: "The intermediate `items` array in `queryProfileContentLibrary` carries an extra `_creationTime: number` field used only for sort, then strips it via a destructuring map with a `void _creationTime` discard before return. The workaround widens the intermediate type, requires destructuring at return, and produces TypeScript noise — three moving parts for one sort key."
dependencies: []
parent_plan_id: workspace/plans/2026-05-14-config-agent-content-authoring-plan.md
acceptance_criteria:
  - "`grep -c '_creationTime' packages/convex/convex/chat/toolQueries.ts` returns 0 (within `queryProfileContentLibrary`)."
  - "The `items` array's TypeScript type matches the `profileContentLibraryItemValidator` exactly."
  - "Existing test `returns owner drafts and published rows across both kinds, newest first` still passes."
  - "`pnpm --filter=@feel-good/convex test` exits 0."
  - "`pnpm --filter=@feel-good/convex check-types` exits 0."
owner_agent: "Convex chat tools refactorer"
---

# queryProfileContentLibrary drops the synthetic _creationTime sort field

## Context

Code review on branch `hpark0011/explain-profile-config-agent` (P2, maintainability lane). At `packages/convex/convex/chat/toolQueries.ts:587-650`, `items` is typed with an extra `_creationTime: number` field populated from `row._creationTime`. It is used only at line 634 for sorting (`items.sort((a, b) => b._creationTime - a._creationTime)`), then stripped via `({ _creationTime, ...rest }) => { void _creationTime; return rest; }`. The same sort behavior is achievable without widening the item type or producing the `void _creationTime` discard.

## Goal

`queryProfileContentLibrary`'s intermediate type matches its return shape, and the sort uses the data already on the row without injection-then-strip.

## Scope

- Restructure the merge-and-sort so `_creationTime` is read off the row at sort time without adding it to the typed item.

## Out of Scope

- Changing the public return shape (`profileContentLibraryItemValidator` stays the same).
- Re-ordering items (newest-first by `_creationTime` is preserved).

## Approach

One clean option: keep the raw rows in their per-kind arrays, sort each array, then interleave or simply merge-then-sort with a comparator that reads `row._creationTime` directly (the `row` retains all its fields until the final `.map` to the item shape). The final `.map(row => ({ kind, slug, title, ... }))` builds the item without a `_creationTime` field at all.

Sketch:
```ts
const collected: Array<{ kind: NavigableContentKind; row: Doc<"posts"> | Doc<"articles"> }> = [];
for (const k of requestedKinds) { /* take and push */ }
collected.sort((a, b) => b.row._creationTime - a.row._creationTime);
return { ..., items: collected.slice(0, effectiveLimit * requestedKinds.length).map(({ kind, row }) => ({ kind, slug: row.slug, ... })) };
```

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Edit `packages/convex/convex/chat/toolQueries.ts:587-650` (`queryProfileContentLibrary` handler).
2. Replace the widened `items` array with a `collected` array of `{ kind, row }` pairs.
3. Sort `collected` by `b.row._creationTime - a.row._creationTime`.
4. Final `.map(...)` builds the item shape — no `_creationTime` in the intermediate type, no `void _creationTime` discard.
5. Run `pnpm --filter=@feel-good/convex test` and `pnpm --filter=@feel-good/convex check-types`.

## Constraints

- Do not change the order of returned items (newest-first by `_creationTime`).
- Do not change which fields the `profileContentLibraryItemValidator` exposes.

## Resources

- Current implementation: `packages/convex/convex/chat/toolQueries.ts:565-651`.
