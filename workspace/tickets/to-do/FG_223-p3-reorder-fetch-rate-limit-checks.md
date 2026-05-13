---
id: FG_223
title: "enforceFetchLimit checks the daily bucket before consuming a minute token"
date: 2026-05-13
type: fix
status: to-do
priority: p3
description: "enforceFetchLimit consumes the per-minute fetchProfileSource token before checking the daily fetchProfileSourceDailyOwner bucket. When the daily check rejects, the minute token has already been decremented for a fetch that never happened — exhausting the conversation's minute bucket without producing a single successful fetch."
dependencies: []
parent_plan_id: workspace/plans/2026-05-13-profile-configuration-helper-agent-plan.md
acceptance_criteria:
  - "enforceFetchLimit in configurationTools.ts checks the daily bucket first; only if the daily check passes does it consume from the minute bucket"
  - "A unit test sets the daily bucket to exhausted and asserts that a fetchProfileSource call rejects without decrementing the minute bucket"
  - "Existing per-minute coverage in the rate-limit suite is unchanged"
  - "pnpm --filter=@feel-good/convex exec vitest run convex/chat/__tests__/ passes"
owner_agent: "Convex chat backend developer"
---

# enforceFetchLimit checks the daily bucket before consuming a minute token

## Context

`packages/convex/convex/chat/configurationTools.ts:316-340`:

```ts
async function enforceFetchLimit(ctx, profileOwnerId, conversationId) {
  const minute = await chatRateLimiter.limit(ctx, "fetchProfileSource", {
    key: conversationId,
    throws: false,
  });
  if (!minute.ok) {
    throw new Error("Profile source fetch limit reached. Try again shortly.");
  }

  const daily = await chatRateLimiter.limit(ctx, "fetchProfileSourceDailyOwner", {
    key: profileOwnerId,
    throws: false,
  });
  if (!daily.ok) {
    throw new Error("Daily profile source fetch limit reached.");
  }
}
```

The minute limit is consumed first. The Convex rate-limiter component consumes a token whenever `limit(..., { throws: false })` returns `ok: true` (or `ok: false` for "fixed window" kind — verify against the component's semantics). Either way: the minute check happens before the daily check. If the daily check then rejects, the minute bucket has been decremented for an operation that did not happen.

The concurrency reviewer rated this P3 (operational concern, not a correctness bug). Realistic scenario: an owner near their daily 25/day cap retries fetching a single resume URL after a transient failure. The minute bucket (3/minute, keyed by conversationId) drains alongside the daily, so when the daily resets the next morning at the same minute window, the conversation's per-minute bucket may also be depleted.

The send/retry paths in `mutations.ts` use a different but related ordering: minute-then-daily for `sendMessage`/`retryMessage`. There, the rate-limiter is invoked from inside a Convex mutation (not action), and the comment at `mutations.ts:170` documents that the limiter does not consume on rejection in that context. The fetch path is an action — each `chatRateLimiter.limit` is a separate cross-call mutation, so the consume-on-success semantics differ.

## Goal

A daily-bucket rejection does not consume a minute token. The per-minute bucket only tracks fetches that the daily budget allows.

## Scope

- Reorder the two `chatRateLimiter.limit` calls in `enforceFetchLimit`.
- One unit test that exhausts the daily bucket and asserts the minute bucket is untouched after a rejection.

## Out of Scope

- Reworking the rate-limit shape itself (capacities, periods).
- Changing the send/retry ordering in `mutations.ts` (separate concern; uses different runtime semantics).

## Approach

Swap the order:

```ts
async function enforceFetchLimit(ctx, profileOwnerId, conversationId) {
  // Check the daily cap FIRST so a rejection here does not consume from
  // the per-conversation per-minute bucket.
  const daily = await chatRateLimiter.limit(ctx, "fetchProfileSourceDailyOwner", {
    key: profileOwnerId,
    throws: false,
  });
  if (!daily.ok) {
    throw new Error("Daily profile source fetch limit reached.");
  }

  const minute = await chatRateLimiter.limit(ctx, "fetchProfileSource", {
    key: conversationId,
    throws: false,
  });
  if (!minute.ok) {
    throw new Error("Profile source fetch limit reached. Try again shortly.");
  }
}
```

Trade-off: now a minute-bucket rejection does NOT consume a daily token. That's the correct semantics — a rejected fetch shouldn't count toward either budget.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Swap the order of the two `chatRateLimiter.limit` calls in `enforceFetchLimit`.
2. Add a unit test that pre-exhausts the daily bucket for an owner, then calls `enforceFetchLimit` and asserts: (a) the call rejects, (b) the minute bucket still has the expected token count remaining.
3. Re-run existing tests to confirm no regression.

## Constraints

- Single-function change. No other files touched.
- Must not change the error messages — the LLM may pattern-match on them today.

## Resources

- PR #93 concurrency review: `fetch-rate-limit-token-consumed-on-daily-failure`
- `packages/convex/convex/chat/configurationTools.ts:316-340`
- `packages/convex/convex/chat/rateLimits.ts:36-46,71-76` — bucket definitions
