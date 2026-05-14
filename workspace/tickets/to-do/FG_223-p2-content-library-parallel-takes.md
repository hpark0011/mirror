---
id: FG_223
title: "queryProfileContentLibrary loads posts and articles in parallel"
date: 2026-05-14
type: perf
status: to-do
priority: p2
description: "When the agent calls `getProfileContentLibrary` without a `kind` filter, the handler awaits the posts `.take()` then the articles `.take()` sequentially, adding one extra Convex DB round-trip per call. The sibling function `queryProfileConfiguration` in the same file already uses `Promise.all` for an analogous two-table read; diverging here leaves an easy parallelization on the table and confuses future readers."
dependencies: []
parent_plan_id: workspace/plans/2026-05-14-config-agent-content-authoring-plan.md
acceptance_criteria:
  - "The two `.take()` calls in `queryProfileContentLibrary` run inside a single `Promise.all`."
  - "Existing test `returns owner drafts and published rows across both kinds, newest first` still passes (ordering by `_creationTime` is preserved by the merge-then-sort)."
  - "`grep -n 'await Promise.all' packages/convex/convex/chat/toolQueries.ts` shows usage inside `queryProfileContentLibrary`."
  - "`pnpm --filter=@feel-good/convex test` exits 0."
owner_agent: "Convex chat tools refactorer"
---

# queryProfileContentLibrary loads posts and articles in parallel

## Context

Code review on branch `hpark0011/explain-profile-config-agent` (P2, performance lane). At `packages/convex/convex/chat/toolQueries.ts:578-635`, the `for (const k of requestedKinds)` loop awaits each `.take()` in sequence. The same file's `queryProfileConfiguration` at line 380 uses `Promise.all` for two index-backed reads with identical motivation. The cost is small (one extra ~1–5 ms DB hop per call) but the divergence is unnecessary.

## Goal

`queryProfileContentLibrary` loads posts and articles concurrently when both kinds are requested.

## Scope

- Replace the sequential `for...of` await loop with `Promise.all` over `requestedKinds.map(...)`.

## Out of Scope

- Changing ordering semantics (newest-first by `_creationTime`).
- Changing how `status` filter interacts with the indexes.

## Approach

Mirror `queryProfileConfiguration`'s pattern: `const results = await Promise.all(requestedKinds.map(k => fetchKind(k)))`, flatten, then sort.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Edit `packages/convex/convex/chat/toolQueries.ts:600-633` (`queryProfileContentLibrary` handler).
2. Replace the `for (const k of requestedKinds)` loop with `await Promise.all(requestedKinds.map(async (k) => { ... return rows.map((row) => ({ kind: k, ...row })); }))`, then flatten with `.flat()`.
3. Keep the sort-by-`_creationTime` step after the flatten (or combine with FG_219 if both land together).
4. Run `pnpm --filter=@feel-good/convex test` and `pnpm --filter=@feel-good/convex check-types`.

## Constraints

- Preserve the newest-first ordering.
- Preserve the per-kind limit (`.take(effectiveLimit)`).

## Resources

- Reference pattern: `packages/convex/convex/chat/toolQueries.ts:380` (`queryProfileConfiguration`).
- Related: FG_219 (`_creationTime` cleanup) — consider sequencing both in the same touch.
