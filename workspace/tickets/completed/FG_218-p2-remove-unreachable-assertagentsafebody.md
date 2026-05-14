---
id: FG_218
title: "Remove unreachable assertAgentSafeBody calls after agentBlocksToTiptapDoc"
date: 2026-05-14
type: refactor
status: completed
priority: p2
description: "`assertAgentSafeBody` is called immediately after `agentBlocksToTiptapDoc` in both branches of `applyContentPatch`. `agentBlocksToTiptapDoc` is the only producer of bodies on the agent path and already rejects every input shape `assertAgentSafeBody` checks — the assertion validates a state that cannot occur. The dead defense misleads future readers who may think the pattern is 'already handled' and skip the assertion when adding a new (genuine) bypass path."
dependencies: []
parent_plan_id: workspace/plans/2026-05-14-config-agent-content-authoring-plan.md
acceptance_criteria:
  - "`grep -c 'assertAgentSafeBody' packages/convex/convex/chat/toolMutations.ts` returns 0."
  - "The `assertAgentSafeBody` export remains in `content/agentBody.ts` with an updated docstring noting it is the boundary guard for any future raw-body callers, not for `applyContentPatch`."
  - "`packages/convex/convex/content/__tests__/agentBody.test.ts` still covers `assertAgentSafeBody` so the function is exercised when re-introduced elsewhere."
  - "`pnpm --filter=@feel-good/convex test` exits 0."
  - "`pnpm --filter=@feel-good/convex check-types` exits 0."
owner_agent: "Convex chat tools refactorer"
---

# Remove unreachable assertAgentSafeBody calls after agentBlocksToTiptapDoc

## Context

Code review on branch `hpark0011/explain-profile-config-agent` (P2, maintainability lane). At `packages/convex/convex/chat/toolMutations.ts:617-618` and `670-673`, `assertAgentSafeBody(body)` runs immediately after `agentBlocksToTiptapDoc(op.bodyBlocks)`. `agentBlocksToTiptapDoc` maps a closed enum of three block types (`paragraph | heading | bulletList`) and throws `AgentBodyError` on every other shape — it cannot produce an image node or an unknown top-level node. `assertAgentSafeBody` therefore validates a state the producer has already made impossible. The function's own docstring (`agentBody.ts:236-248`) claims it guards "when the caller bypassed `agentBlocksToTiptapDoc`", but there is no such caller in the agent path.

## Goal

The defense lives only at boundaries where a real bypass is possible. The current redundant calls are removed, and `assertAgentSafeBody`'s docstring describes its actual contract.

## Scope

- Remove `assertAgentSafeBody(body)` from both create and update branches of `applyContentPatch`.
- Tighten the `assertAgentSafeBody` docstring in `agentBody.ts` to identify the function as a boundary guard for any future raw-Tiptap caller (none today).

## Out of Scope

- Removing the function itself — keep it as the boundary guard for future use.
- Removing the existing `agentBody.test.ts` coverage for `assertAgentSafeBody`.

## Approach

Delete the two `assertAgentSafeBody` call lines and the immediately-prior IIFE wrapping in the update branch. Update the docstring.

- **Effort:** Small
- **Risk:** Low — `agentBlocksToTiptapDoc` is the only producer, so removing the dead-after assertion does not lose any guarantee.

## Implementation Steps

1. Edit `packages/convex/convex/chat/toolMutations.ts:617-618` (create branch): remove the `assertAgentSafeBody(body)` line; keep the `agentBlocksToTiptapDoc(op.bodyBlocks)` call.
2. Edit `packages/convex/convex/chat/toolMutations.ts:668-675` (update branch): simplify the IIFE to a direct ternary — `op.bodyBlocks !== undefined ? agentBlocksToTiptapDoc(op.bodyBlocks) : undefined`.
3. Edit `packages/convex/convex/content/agentBody.ts:236-248` docstring: rewrite to describe `assertAgentSafeBody` as a boundary guard for any caller that constructs a Tiptap doc by hand; note that `agentBlocksToTiptapDoc` does not need it because its output is already constrained.
4. Run `pnpm --filter=@feel-good/convex test` and `pnpm --filter=@feel-good/convex check-types`.

## Constraints

- Do not remove `assertAgentSafeBody` from the exports of `agentBody.ts`.
- Keep the `agentBody.test.ts` cases for `assertAgentSafeBody` intact.

## Resources

- `packages/convex/convex/content/agentBody.ts:236-277` (function + docstring).
- Code review finding (maintainability lane).
