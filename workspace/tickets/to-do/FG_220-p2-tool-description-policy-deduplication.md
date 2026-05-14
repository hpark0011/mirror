---
id: FG_220
title: "Behavioral policy lives only in configurationPrompt vocabulary"
date: 2026-05-14
type: refactor
status: to-do
priority: p2
description: "The `applyContentPatch` tool description embeds behavioral guidance (`Confirm with the owner before publishing immediately or replacing a non-empty body`) that is already present in `CONFIGURATION_TOOLS_VOCABULARY` in `configurationPrompt.ts`. Two sources of truth for the same policy means an editor updating only one creates a behavioral divergence the LLM will resolve arbitrarily."
dependencies: []
parent_plan_id: workspace/plans/2026-05-14-config-agent-content-authoring-plan.md
acceptance_criteria:
  - "`applyContentPatch.description` in `configurationTools.ts` describes capability and hard limits only (no `Confirm with the owner...` policy text)."
  - "`CONFIGURATION_TOOLS_VOCABULARY` in `configurationPrompt.ts` still carries the full confirmation policy."
  - "`grep -c 'Confirm with the owner' packages/convex/convex/chat/configurationTools.ts` returns 0."
  - "`grep -c 'ask for confirmation' packages/convex/convex/chat/configurationPrompt.ts` returns >= 1."
  - "`pnpm --filter=@feel-good/convex test` exits 0 (the rate-limits test pinning the tools list is unaffected)."
owner_agent: "Convex chat tools refactorer"
---

# Behavioral policy lives only in configurationPrompt vocabulary

## Context

Code review on branch `hpark0011/explain-profile-config-agent` (P2, maintainability lane). At `packages/convex/convex/chat/configurationTools.ts:765-767`, the `applyContentPatch` description says "Confirm with the owner before publishing immediately or replacing a non-empty body." The same policy is already worded (more thoroughly) in `CONFIGURATION_TOOLS_VOCABULARY` at `configurationPrompt.ts:9`: "Before deleting any content, replacing a non-empty body, publishing immediately, or writing more than three bio entries at once, summarize what you found and ask for confirmation." Two sources for the same rule make it easy to drift.

## Goal

Tool descriptions describe what the tool does (capability + hard constraint). Behavioral policy (when to ask for confirmation, what to default, what to avoid) lives only in the system prompt vocabulary.

## Scope

- Trim the `applyContentPatch` tool description to capability + the hard 5-operation cap.
- Keep `CONFIGURATION_TOOLS_VOCABULARY` as the single home of behavioral guidance.

## Out of Scope

- Touching `applyBioEntryPatch` / `applyContactEntryPatch` descriptions (they have similar lighter-touch policy text — separate ticket if worth doing).
- Rewording the vocabulary; the existing text is sufficient.

## Approach

Edit one tool description. The system prompt vocabulary already covers the behavior.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Edit `packages/convex/convex/chat/configurationTools.ts:765-767` `applyContentPatch.description`: remove "Confirm with the owner before publishing immediately or replacing a non-empty body." Keep capability description and "Max 5 operations per call."
2. Verify `CONFIGURATION_TOOLS_VOCABULARY` in `configurationPrompt.ts` still contains the confirmation policy.
3. Run `pnpm --filter=@feel-good/convex test`.

## Constraints

- Do not delete the hard 5-operation cap from the description (it is a structural fact, not behavioral policy).
- Do not edit the vocabulary in the same change; keep the diff scope-tight.

## Resources

- `packages/convex/convex/chat/configurationPrompt.ts:9` (vocabulary).
- `packages/convex/convex/chat/configurationTools.ts:702-781` (current tool descriptions).
