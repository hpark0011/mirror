---
id: FG_220
title: "sendConfigurationDailyOwner bucket exhaustion + token-charge formula are tested"
date: 2026-05-13
type: chore
status: to-do
priority: p2
description: "The new sendConfigurationDailyOwner token bucket (capacity 15,000; rate 60,000/day; keyed by owner) and the Math.ceil(content.length/4) token-charge heuristic in mutations.ts:88 are uncovered by tests. A change to the formula or a misconfigured bucket capacity would not be caught."
dependencies: []
parent_plan_id: workspace/plans/2026-05-13-profile-configuration-helper-agent-plan.md
acceptance_criteria:
  - "packages/convex/convex/chat/__tests__/rateLimits.test.ts contains a test that sends configuration messages with known content length until sendConfigurationDailyOwner throws RATE_LIMIT_DAILY"
  - "The test asserts the structured ConvexError code is 'RATE_LIMIT_DAILY'"
  - "The test asserts streamingInProgress on the conversation row was not set when the limit was rejected"
  - "Either estimateInputTokenCount is exported and unit-tested directly, or an integration test pins the formula by sending a 4000-char message and asserting ~1000 tokens were charged"
  - "pnpm --filter=@feel-good/convex exec vitest run convex/chat/__tests__/rateLimits.test.ts passes"
owner_agent: "Convex test engineer"
---

# sendConfigurationDailyOwner bucket exhaustion + token-charge formula are tested

## Context

PR #93 adds two pieces of rate-limit machinery for configuration mode:

1. **`sendConfigurationDailyOwner` token bucket** at `packages/convex/convex/chat/rateLimits.ts:71-76`:
   ```ts
   sendConfigurationDailyOwner: {
     kind: "token bucket",
     rate: 60_000,
     period: DAY,
     capacity: 15_000,
   }
   ```

2. **Token-charge heuristic** at `packages/convex/convex/chat/mutations.ts:87-88`:
   ```ts
   function estimateInputTokenCount(content: string): number {
     return Math.max(1, Math.ceil(content.length / 4));
   }
   ```

The Wave-1 tests (FR-03 through FR-07) exhaustively cover the anon and auth daily buckets — boundary conditions, refill, churn-attack via new-conversation. The configuration suite added in this PR tests auth guards, mode immutability, and the streaming prompt — but neither the daily bucket nor the charge formula.

The tests reviewer rated this P2: a change to the formula (e.g., accidentally charging `1` instead of `Math.ceil`) or a misconfigured bucket capacity would pass the suite. The PR's own retro lessons document the rate-limit shape as a load-bearing invariant.

## Goal

The token bucket and the charge formula are both pinned by tests. A regression to either fails the test suite before it can land.

## Scope

- New test(s) in `packages/convex/convex/chat/__tests__/rateLimits.test.ts` under the `chat configuration mode invariants` describe block.
- Decision: export `estimateInputTokenCount` for direct unit testing (preferred) OR pin via integration test that sends a known-length payload and asserts subsequent exhaustion.

## Out of Scope

- Replacing the heuristic with a proper tokenizer (CodeRabbit nitpick on the plan, deferred).
- Changing the bucket capacity or rate.
- Per-minute bucket coverage (already covered by existing tests in the configuration suite).

## Approach

Two complementary tests:

1. **Formula test (preferred):** export `estimateInputTokenCount` from `mutations.ts` (or a sibling helper) and unit-test it:
   ```ts
   expect(estimateInputTokenCount("")).toBe(1);
   expect(estimateInputTokenCount("a")).toBe(1);
   expect(estimateInputTokenCount("a".repeat(4))).toBe(1);
   expect(estimateInputTokenCount("a".repeat(4001))).toBe(1001);
   ```

2. **Exhaustion test:** seed an owner, send a single 12,000-char configuration message (which charges ~3,000 tokens), then send a second 12,000-char message (which charges another ~3,000 tokens, taking the bucket below capacity). Repeat until exhausted. After the rejection, assert the conversation row's `streamingInProgress` is false.

For the exhaustion test, the existing fake auth + rate-limit-component-stub pattern at `rateLimits.test.ts:47-220` should provide the surface needed.

- **Effort:** Medium
- **Risk:** Low

## Implementation Steps

1. Export `estimateInputTokenCount` from `packages/convex/convex/chat/mutations.ts` (or move it into a small helper file if export pollutes the module surface).
2. Add a small `describe` block exercising the formula at known boundaries.
3. Add an integration test that exhausts `sendConfigurationDailyOwner` by sending sequential 12,000-char messages and asserts the eventual ConvexError code is `RATE_LIMIT_DAILY` and `streamingInProgress` is false.
4. Run the test suite to confirm both pass.
5. Manually break the formula (return `1` instead of `Math.ceil(...)`) and confirm the integration test fails (the daily bucket never exhausts because every message only charges 1 token); revert.

## Constraints

- Must not slow the test file materially — the exhaustion test should use the fewest messages necessary (12,000 char messages charge ~3,000 tokens; 5 of them exhaust the 15,000-token capacity).
- Must follow the existing rateLimits.test.ts patterns (makeT helper, authState mock, etc.).

## Resources

- PR #93 tests review: `config-daily-rate-limit-bucket-untested`
- `packages/convex/convex/chat/rateLimits.ts:71-76` — bucket definition
- `packages/convex/convex/chat/mutations.ts:87-88` — formula
- `packages/convex/convex/chat/__tests__/rateLimits.test.ts:617+` — configuration mode invariants suite
