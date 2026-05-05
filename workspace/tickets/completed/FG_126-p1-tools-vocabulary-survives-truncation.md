---
id: FG_126
title: "TOOLS_VOCABULARY survives system-prompt budget pressure"
date: 2026-05-05
type: fix
status: completed
priority: p1
description: "TOOLS_VOCABULARY (the system-prompt sentence that names the clone agent's two tools) is currently pushed into the truncatable region of composeSystemPrompt. Under realistic budget pressure (large persona prompt + bio + topics) the proportional shrinker can reduce its share to ~35 chars — neither getLatestPublished nor navigateToContent appears, so the agent falls back to text and never calls its own tools. Move the vocabulary line into the fixed region alongside STYLE_RULES and add survival assertions to the FR-09 oversize tests."
dependencies: []
parent_plan_id: docs/plans/2026-05-04-feat-agent-ui-parity-plan.md
acceptance_criteria:
  - "`grep -n 'TOOLS_VOCABULARY' packages/convex/convex/chat/helpers.ts` shows the constant pushed into the `fixed` array, not `truncatable`"
  - "`grep -n \"truncatable.push(TOOLS_VOCABULARY)\" packages/convex/convex/chat/helpers.ts` returns no matches"
  - "Existing helpers.test.ts FR-09 oversize cases (lines 130-203) gain `expect(result).toContain('navigateToContent')` and `expect(result).toContain('getLatestPublished')` assertions"
  - "The 'truly-minimal call (only name, all other fields omitted)' test at helpers.test.ts:91-96 gains the same toContain('navigateToContent') assertion"
  - "Section-order tests still pass — TOOLS_VOCABULARY appears AFTER tone clause and BEFORE bio/persona/topics (since fixed region precedes truncatable)"
  - "`pnpm --filter=@feel-good/convex test:unit packages/convex/convex/chat/__tests__/helpers.test.ts` passes"
  - "`pnpm build --filter=@feel-good/mirror` and `pnpm lint --filter=@feel-good/mirror` both pass"
owner_agent: "Convex chat backend developer"
---

# TOOLS_VOCABULARY survives system-prompt budget pressure

## Context

Code review on `feature-agent-parity-architecture` (correctness + agent-native reviewers, both at P1 confidence ~0.92) found that the `TOOLS_VOCABULARY` line — the only place the system prompt names `getLatestPublished` and `navigateToContent` — is fragile under budget pressure.

`packages/convex/convex/chat/helpers.ts:197-198`:

```ts
truncatable.push(TOOLS_VOCABULARY);
```

`composeSystemPrompt` then runs `truncateToBudget(fixed, truncatable)`, which proportionally shrinks every truncatable item:

```ts
const share = Math.floor((p.length / truncatableTotal) * budget);
return p.slice(0, share);
```

For a user with a verbose `personaPrompt` (~12,000 chars), large `bio` (~6,000 chars), and detailed `topicsToAvoid` (~6,000 chars), the truncatable total is ~24,000 chars and the budget is ~5,400. TOOLS_VOCABULARY's share collapses to `floor(161/24000 * 5400) ≈ 35` chars, which is `"You can open content for the visito"` — neither tool name survives.

The agent learns nothing about its tool surface and silently falls back to text. The bug only manifests for users who fill in all profile fields extensively, but for those users the navigation feature is silently dead.

The existing FR-09 oversize tests (`packages/convex/convex/chat/__tests__/helpers.test.ts:130-203`) assert `STYLE_RULES` and tone clause survive but never assert `navigateToContent` survives — the gap that allowed this regression to land.

## Goal

The system prompt always contains the literal strings `getLatestPublished` and `navigateToContent` regardless of how large any user-controlled field is, and tests pin this invariant under both minimal and maximal field combinations.

## Scope

- In `packages/convex/convex/chat/helpers.ts`, move `TOOLS_VOCABULARY` from the `truncatable` array into the `fixed` array alongside `SAFETY_PREFIX(name)` and `STYLE_RULES`.
- Update `truncateToBudget`'s caller-side comment block (helpers.ts:106-148) to mention TOOLS_VOCABULARY among the load-bearing fixed sections.
- Update the existing FR-09 oversize tests in `helpers.test.ts:130-203` to assert both tool names appear.
- Update the "truly-minimal call" test at `helpers.test.ts:91-96` to assert `navigateToContent` appears.
- Update the `composeSystemPrompt` section-order test to reflect that the tools-vocabulary is now placed before bio/persona/topics (after STYLE_RULES and tone clause).

## Out of Scope

- Changing the wording of the TOOLS_VOCABULARY string. (Phrasing changes belong in a separate ticket if the agent's tool-call recall ever degrades.)
- Adding new tool descriptions to the vocabulary. (FG_125 onward — adding a new verb adds a new sentence per the parity rule's four-step checklist.)
- Reworking the `truncateToBudget` allocator. The fix is moving TOOLS_VOCABULARY out of truncatable, not redesigning the budget split.

## Approach

The fixed array currently contains `[SAFETY_PREFIX(name), STYLE_RULES]` plus an optional tone clause (helpers.ts:168-171). Append `TOOLS_VOCABULARY` after the tone clause so the order becomes safety → style → tone → tools-vocab. This puts the agent's tool awareness in the load-bearing region alongside other system-contract content.

Section order shifts: previously `safety → style → tone → bio → persona → topics → inventory → tools-vocab`. After the fix: `safety → style → tone → tools-vocab → bio → persona → topics → inventory`. The change is observable to the LLM but should not affect behavior — the tool vocabulary is reference material, not user content. Update the section-order assertion test (`helpers.test.ts:205-229`) to reflect the new position.

The pathological-case backstop at `helpers.ts:208-210` (`joined.slice(0, SYSTEM_PROMPT_MAX_CHARS)`) still applies. With TOOLS_VOCABULARY in the fixed array (161 chars), a name long enough to exhaust the budget can theoretically still hard-cap and lose the vocabulary, but `MAX_NAME_CHARS = 200` (helpers.ts:87) bounds the safety prefix size, so the fixed total is ~600 chars worst case — well under the 6000 budget.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. In `packages/convex/convex/chat/helpers.ts`, move `truncatable.push(TOOLS_VOCABULARY);` (line 197) into the `fixed` array at the equivalent of line 171, immediately after the optional tone clause push.
2. Update the section-comment block at lines 164-167 to list TOOLS_VOCABULARY as part of the fixed region.
3. Edit `packages/convex/convex/chat/__tests__/helpers.test.ts:91-96` ("truly-minimal call") to add `expect(result).toContain("navigateToContent")` and `expect(result).toContain("getLatestPublished")`.
4. Edit each of the four FR-09 oversize tests (lines 130-203) to add the same two `toContain` assertions after the existing `length <= SYSTEM_PROMPT_MAX_CHARS` assertion.
5. Edit the section-order test at `helpers.test.ts:205-229` to assert `toolsIdx > toneIdx` and `bioIdx > toolsIdx` (instead of the current `toolsIdx > topicsIdx`).
6. Run `pnpm --filter=@feel-good/convex test:unit packages/convex/convex/chat/__tests__/helpers.test.ts` and confirm all section-order + budget tests pass.
7. Run `pnpm build --filter=@feel-good/mirror` and `pnpm lint --filter=@feel-good/mirror`.

## Constraints

- Do not change the TOOLS_VOCABULARY string itself.
- Do not change `SYSTEM_PROMPT_MAX_CHARS` or `MAX_NAME_CHARS`.
- Keep the contentInventory sentence in the truncatable region — it is genuinely user-derived (depends on which kinds the owner has populated) and may legitimately compress if context budget runs tight.
- The `nonEmptyShrunk` filter at helpers.ts:145 stays as-is.

## Resources

- `.claude/rules/agent-parity.md` § Footguns: "A new tool registered in `buildCloneTools` without a matching mention in `TOOLS_VOCABULARY` is a discoverability gap"
- Code review report from `/review-code` on `feature-agent-parity-architecture` (2026-05-05) — P1 cluster 3 + P2 cluster (TOOLS_VOCABULARY survival tests)
- `packages/convex/convex/chat/helpers.ts:79-80` (current TOOLS_VOCABULARY definition)
