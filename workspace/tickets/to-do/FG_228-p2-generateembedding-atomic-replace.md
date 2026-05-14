---
id: FG_228
title: "generateEmbedding atomically replaces existing embedding rows per source"
date: 2026-05-14
type: fix
status: to-do
priority: p2
description: "[Pre-existing — not introduced by PLAN_013] `generateEmbedding` deletes then inserts via two separate `ctx.runMutation` calls. Two concurrent jobs for the same `sourceId` can interleave (A.delete, B.delete, A.insert, B.insert) and leave duplicate `contentEmbeddings` rows that inflate RAG vector-search scores. The agent's new 5-op batch raises the probability by fanning out N jobs with delay 0, but the underlying race predates this PR."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "Either: (a) the delete-then-insert is wrapped in a single mutation that atomically replaces old rows with new, OR (b) `insertChunks` performs a version-token check and discards stale rows."
  - "A test exercises two concurrent `generateEmbedding` calls for the same sourceId and asserts a single set of `contentEmbeddings` rows results."
  - "`pnpm --filter=@feel-good/convex test` exits 0."
owner_agent: "Convex embeddings author"
---

# generateEmbedding atomically replaces existing embedding rows per source

## Context

**Pre-existing — surfaced by code review of PLAN_013 but not introduced by this PR.** Triagers can decide whether to take this on now or open as a separate workstream.

Code review on branch `hpark0011/explain-profile-config-agent` (P2, concurrency lane). `packages/convex/convex/embeddings/actions.ts:113-134` performs:
```ts
await ctx.runMutation(deleteBySource, ...);
await ctx.runMutation(insertChunks, ...);
```
Two separate transactions. When two jobs for the same `sourceId` execute concurrently (e.g., editor save twice in quick succession, or agent batch with multiple publish ops), they can interleave and double-write embedding rows. The new agent path makes this reachable from a single user action (one `applyContentPatch` with N publish ops) but the underlying delete-then-insert non-atomicity exists for every existing publish path.

## Goal

Concurrent `generateEmbedding` calls for the same `sourceId` cannot leave duplicate embedding rows.

## Scope

- Audit the current delete-then-insert in `embeddings/actions.ts`.
- Implement an atomic replace pattern (one mutation that replaces all rows for a `sourceId`) OR a version-token approach.

## Out of Scope

- Touching the scheduler logic that triggers `generateEmbedding`.
- Changing what content gets embedded.

## Approach

Option A — atomic replace inside a single mutation:
```ts
// in a single internalMutation:
await deleteBySourceInline(ctx, { sourceTable, sourceId });
await insertChunksInline(ctx, { sourceTable, sourceId, chunks });
```
The action computes chunks, then calls the combined mutation. The mutation is one transaction → atomic.

Option B — version token: include `generation: number` on each embedding row; the action stores its generation before insert; insertChunks discards inserts where the row's generation is no longer current.

Option A is simpler and matches the existing patterns.

- **Effort:** Medium
- **Risk:** Medium (touches a hot ingestion path; needs a regression test).

## Implementation Steps

1. Read `packages/convex/convex/embeddings/actions.ts` to understand the current shape.
2. Implement an `internalMutation.replaceChunksForSource({ sourceTable, sourceId, chunks })` that does delete-then-insert in one transaction.
3. Update `generateEmbedding` to call the combined mutation.
4. Add a concurrent-call test (or document why the test harness cannot simulate it and rely on the structural argument).
5. Run `pnpm --filter=@feel-good/convex test`.

## Constraints

- Preserve the existing `deleteBySource` mutation for the unpublish/delete cleanup path (it is called from writeHelpers when content drops to draft or is deleted — not as part of replacement).
- Do not change the public action signature.

## Resources

- `packages/convex/convex/embeddings/actions.ts:113-134`.
- Code review note: pre-existing race exacerbated by `applyContentPatch` batch fan-out.
