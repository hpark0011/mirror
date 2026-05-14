---
id: FG_222
title: "bodyBlocks minimum length is consistent across Zod, Convex, and adapter layers"
date: 2026-05-14
type: fix
status: to-do
priority: p2
description: "The Zod schema in `configurationTools.ts` requires `bodyBlocks.min(1)` for create operations, but the Convex validator in `toolMutations.ts` accepts empty arrays and `agentBlocksToTiptapDoc` explicitly returns a single-empty-paragraph doc on `blocks.length === 0`. The three layers disagree on whether zero-block bodies are valid. The Zod constraint fires at the LLM boundary, but a direct internal caller can pass `[]` and the create path will succeed with an empty body."
dependencies: []
parent_plan_id: workspace/plans/2026-05-14-config-agent-content-authoring-plan.md
acceptance_criteria:
  - "Either: (a) `bodyBlocks: z.array(...).min(1)` is dropped from the Zod create schema and `agentBlocksToTiptapDoc([])` returning the empty-paragraph doc is documented as the intended empty-editor state, OR (b) `agentBlocksToTiptapDoc([])` throws and the Convex validator enforces `v.array(...).min(1)` (or equivalent)."
  - "All three layers (Zod, Convex validator, adapter) agree on whether zero blocks is valid."
  - "`agentBody.test.ts` has a test asserting the chosen behavior."
  - "`pnpm --filter=@feel-good/convex test` exits 0."
owner_agent: "Convex content adapter aligner"
---

# bodyBlocks minimum length is consistent across Zod, Convex, and adapter layers

## Context

Code review on branch `hpark0011/explain-profile-config-agent` (P2, data-integrity lane). Three layers describe `bodyBlocks` differently:

- `configurationTools.ts:164` — Zod: `bodyBlocks: z.array(agentContentBlockSchema).min(1)`
- `toolMutations.ts:464` — Convex validator: `bodyBlocks: v.array(agentBodyBlockValidator)` (no minimum)
- `agentBody.ts:74-76` — adapter: `if (blocks.length === 0) { return { type: 'doc', content: [{ type: 'paragraph' }] }; }` (silently produces an empty doc)

The Zod `.min(1)` only fires when the tool's `execute` parses LLM input. Any internal caller of `applyContentPatch` (current there is none, but tests or future actions could) can supply `[]` and the create path succeeds with an empty body — the constraint the Zod layer was meant to enforce is invisible at the Convex boundary.

## Goal

A single decision about whether `bodyBlocks` may be empty on create, applied uniformly across all three layers.

## Scope

- Pick an approach (recommendation: allow empty — the editor's empty-paragraph state is a valid Tiptap doc and matches existing editor semantics).
- Drop or add the `.min(1)` constraint at the Zod and Convex layers to match.
- Update or add a test asserting the chosen behavior.

## Out of Scope

- Changing the empty-state representation (the `{ type: 'doc', content: [{ type: 'paragraph' }] }` shape is the editor convention — do not change it).
- Touching the update branch (`bodyBlocks` is optional there; only create is at issue).

## Approach

Recommended: remove `.min(1)` from the Zod create schema. The adapter already handles `[]` as the empty-editor state, which is what the editor would persist for an empty post; making this an explicit policy keeps the agent path consistent with the editor's behavior.

If instead the project intent is "agent must supply content on create" (likely the reason the `.min(1)` was added), tighten the Convex validator and make `agentBlocksToTiptapDoc([])` throw.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Make the decision (default: allow empty).
2. If allow-empty: delete `.min(1)` from `configurationTools.ts:170` (create) and remove the early-return in `agentBody.ts:74-76` (leave the empty `content` array — but verify the existing tests for empty doc still hold).
3. If require-content: add a length check inside `agentBlocksToTiptapDoc` that throws `AgentBodyError` on empty, AND tighten the Convex `contentPatchOperationValidator` to enforce min length (Convex `v.array` does not support min-length natively; throw inside the handler in the create branch).
4. Add a test in `agentBody.test.ts` pinning the chosen behavior (`returns empty paragraph for empty blocks` already exists; either keep or replace with a throw assertion).
5. Run `pnpm --filter=@feel-good/convex test`.

## Constraints

- All three layers must agree.
- Choose one direction and document the rationale in a code comment at `agentBlocksToTiptapDoc`.

## Resources

- `packages/convex/convex/content/agentBody.ts:65-130`.
- `packages/convex/convex/chat/configurationTools.ts:146-187`.
- `packages/convex/convex/chat/toolMutations.ts:443-481`.
