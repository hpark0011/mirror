---
id: FG_221
title: "getProfileContentForEdit tool result shape is captured in a single source of truth"
date: 2026-05-14
type: fix
status: to-do
priority: p2
description: "The `getProfileContentForEdit` tool wraps the internal query result by adding a `found: boolean` field — `{ ...row, found: true }` on hit, `{ kind, slug, found: false }` on miss. The `found` field is not part of the underlying query's `returns` validator (`ownedContentForEditReturnValidator`), so the LLM sees a shape neither validator fully describes. A future change to the query return shape will not catch that `found` is missing."
dependencies: []
parent_plan_id: workspace/plans/2026-05-14-config-agent-content-authoring-plan.md
acceptance_criteria:
  - "Either: (a) the internal query returns `{ found, ...rest }` and the validator includes `found: v.boolean()` in both union branches, OR (b) the tool handler is the sole owner of `found` and the query keeps its current null-on-miss shape — chosen and documented."
  - "If approach (a): `grep -n 'found' packages/convex/convex/chat/toolQueries.ts` returns matches and the new validator branches are present."
  - "If approach (b): `grep -n 'found' packages/convex/convex/chat/configurationTools.ts` is the only `found` reference and a comment notes the query-vs-tool layering."
  - "`pnpm --filter=@feel-good/convex test` exits 0 (including the existing read-only watcher test that consumes `{ found: true, ... }`)."
  - "`pnpm --filter=@feel-good/convex check-types` exits 0."
owner_agent: "Convex chat tools refactorer"
---

# getProfileContentForEdit tool result shape is captured in a single source of truth

## Context

Code review on branch `hpark0011/explain-profile-config-agent` (P2, data-integrity lane). The internal query `queryOwnedContentForEdit` at `packages/convex/convex/chat/toolQueries.ts:702-738` returns `v.union(v.null(), v.object({ kind, slug, title, ..., bodyText, bodyBlocks }))` — no `found` field. The tool layer at `configurationTools.ts:740-762` rewrites the shape: `if (!row) return { kind, slug, found: false }; return { ...row, found: true };`. The Convex `returns` validator enforces shape at the query layer, not at the tool's `execute` return — so `found` is not validated anywhere structural.

## Goal

The LLM-visible shape of `getProfileContentForEdit` has a single source of truth that catches drift at type-check time.

## Scope

- Decide between (a) bring `found` into the query validator, or (b) collapse the wrapper and document the layering.
- Implement the chosen approach.

## Out of Scope

- Changing the agent's prompt or watcher behavior (the watcher ignores `getProfileContentForEdit` — read-only tool).
- Editing other tool result shapes.

## Approach

Recommended option (a): move `found` into the query so the validator captures the contract. The internal query becomes:
```ts
returns: v.union(
  v.object({ found: v.literal(false), kind: navigableContentKindValidator, slug: v.string() }),
  v.object({ found: v.literal(true), kind: ..., slug: ..., title: ..., ... }),
);
```
The tool handler then returns the query result unchanged.

Option (b) is acceptable if there's a reason to keep the query null-shaped — but document it.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Edit `packages/convex/convex/chat/toolQueries.ts` `ownedContentForEditReturnValidator`: rewrite as a discriminated union over `found`.
2. Edit `queryOwnedContentForEdit` handler to return `{ found: false, kind, slug }` on miss and `{ found: true, ...rest }` on hit (consuming `args.kind` and `args.slug` for the miss case).
3. Edit `configurationTools.ts:740-762` to return the query result directly (no `{ ...row, found: true }` rewrap).
4. Update `apps/mirror/features/chat/hooks/__tests__/use-agent-intent-watcher.test.ts` read-only test if its `output` shape needs adjusting.
5. Run `pnpm --filter=@feel-good/convex test`, `pnpm --filter=@feel-good/mirror test:unit`, `pnpm --filter=@feel-good/convex check-types`.

## Constraints

- Preserve the LLM-visible shape (`found: boolean` + same data fields on hit) — don't introduce a breaking change to what the agent reads.
- Make the choice explicit in a brief code comment.

## Resources

- `packages/convex/convex/chat/toolQueries.ts:653-738`.
- `packages/convex/convex/chat/configurationTools.ts:740-762`.
