---
id: FG_227
title: "queryOwnedContentForEdit walks the body tree once for text and blocks"
date: 2026-05-14
type: perf
status: to-do
priority: p3
description: "`queryOwnedContentForEdit` calls `tiptapDocToPlainText(row.body)` and `tiptapDocToAgentBlocks(row.body)` back-to-back, each independently walking the body tree. At `MAX_BLOCKS_PER_BODY = 200` this is microseconds and the tool is called at most once per agent reasoning step — advisory only."
dependencies: []
parent_plan_id: workspace/plans/2026-05-14-config-agent-content-authoring-plan.md
acceptance_criteria:
  - "Either: (a) a combined function emits both `bodyText` and `bodyBlocks` in a single walk, OR (b) this ticket is closed as won't-fix with a brief rationale."
  - "If (a): existing `agentBody.test.ts` round-trip and projection cases still pass."
  - "If (a): `pnpm --filter=@feel-good/convex test` exits 0."
owner_agent: "Convex content adapter tidier (optional)"
---

# queryOwnedContentForEdit walks the body tree once for text and blocks

## Context

Code review on branch `hpark0011/explain-profile-config-agent` (P3, performance lane — advisory). Two sequential walks of the same body tree at `packages/convex/convex/chat/toolQueries.ts:700-735`. At current call volumes and body sizes (200 block ceiling) the cost is unmeasurable. Filed for completeness; close as won't-fix unless `getProfileContentForEdit` is ever called in a batch context.

## Goal

Either a single combined walk, or an explicit decision that two walks is acceptable at current call volumes.

## Scope

- Either implement a combined emitter or close the ticket with a one-line rationale.

## Out of Scope

- Changing the public shapes returned by `tiptapDocToPlainText` and `tiptapDocToAgentBlocks` for other callers.

## Approach

Optional. If implemented: add a `tiptapDocToAgentRepresentation(body): { text: string; blocks: AgentContentBlock[] }` in `agentBody.ts` that walks the tree once, emit both, and call it from `queryOwnedContentForEdit`.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Decide whether to do this work now or defer.
2. If defer: close the ticket with a one-line rationale in `canceled/`.
3. If implement: add the combined emitter to `agentBody.ts`, add an `agentBody.test.ts` case asserting it emits the same values as calling the two existing functions, replace the two calls in `queryOwnedContentForEdit`.
4. Run `pnpm --filter=@feel-good/convex test`.

## Constraints

- Keep `tiptapDocToPlainText` and `tiptapDocToAgentBlocks` available for other callers (the new combined emitter is additive, not a replacement).

## Resources

- `packages/convex/convex/chat/toolQueries.ts:734-735`.
- `packages/convex/convex/content/agentBody.ts:131-234`.
