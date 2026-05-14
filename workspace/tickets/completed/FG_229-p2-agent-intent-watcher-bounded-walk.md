---
id: FG_229
title: "useAgentIntentWatcher only walks new messages on each effect run"
date: 2026-05-14
type: perf
status: completed
priority: p2
description: "[Pre-existing — not introduced by PLAN_013] `useAgentIntentWatcher`'s effect re-walks every assistant message × parts whenever the `messages` array reference changes (i.e., on every streaming chunk). At 50 messages × 10 parts = 500 iterations per ~50–100 ms tick. The `handled` Set short-circuits dispatch but not the scan. This PR adds one filter constant but does not change scaling. Tracking the last-scanned index would bound re-work to only new messages."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "The watcher's `useEffect` tracks the last-scanned message index via `useRef` and walks only from that index forward on each run."
  - "All existing watcher tests still pass (idempotency, malformed, read-only, applyContentPatch routing)."
  - "A new test seeds a long-history scenario and asserts the dispatch count is unchanged after multiple re-renders."
  - "`pnpm --filter=@feel-good/mirror test:unit` exits 0."
owner_agent: "Mirror chat watcher refactorer"
---

# useAgentIntentWatcher only walks new messages on each effect run

## Context

**Pre-existing — surfaced by code review of PLAN_013 but not introduced by this PR.** Triagers can defer.

Code review on branch `hpark0011/explain-profile-config-agent` (P2, performance lane). `apps/mirror/features/chat/hooks/use-agent-intent-watcher.ts:329-493` walks `messages × parts` every effect run. The effect re-runs whenever the array reference changes — Convex/AI SDK replaces the array on every streaming chunk, so during active streaming the effect runs many times per second. The `handled` set short-circuits dispatching but every part still gets type-checked and ID-looked-up. For a long configuration session this is wasted CPU on the render thread.

## Goal

The watcher walks only messages it has not already processed; the scan cost grows with new history, not total history.

## Scope

- Add a `useRef<number>` tracking the highest-scanned message index per `conversationId`.
- On each effect run, walk only from that index forward.

## Out of Scope

- Changing the `handledByConversation` Map semantics (the cross-mount idempotency contract).
- Changing the dispatch logic per tool type.

## Approach

Per-conversation last-scanned index in a `useRef<Map<string, number>>`. On effect run, start the outer `for (const message of messages)` loop from `lastScannedIndex` (or 0 for a new conversation), then update the ref to `messages.length` at the end.

Subtle: messages can be inserted into the middle of the array if the SDK ever reorders, which would skip the older parts. In practice the AI SDK appends only — but a guard could fall back to a full scan when `messages.length < lastScanned` (i.e., the array shrank, which means a remount or new conversation).

- **Effort:** Small
- **Risk:** Medium (touches the watcher's hot path; existing tests must pin idempotency invariants stronger than they do today).

## Implementation Steps

1. Edit `apps/mirror/features/chat/hooks/use-agent-intent-watcher.ts`: add a `useRef<Map<string, number>>` storing the last-scanned length per conversationId.
2. Read the per-conversation last-scanned index at effect start.
3. Walk messages from that index forward.
4. Update the index to `messages.length` at the end of the effect.
5. Guard against `messages.length < lastScanned` (treat as reset).
6. Run `pnpm --filter=@feel-good/mirror test:unit` to confirm existing watcher tests still pass.
7. Optionally add a perf-regression test that spies on a hot-path operation and asserts the walk count.

## Constraints

- Cross-mount idempotency must continue to hold (already enforced by `handledByConversation`).
- Do not introduce a per-mount fallback that re-scans everything — that would defeat the optimization.

## Resources

- `apps/mirror/features/chat/hooks/use-agent-intent-watcher.ts:329-493`.
- Code review note: pre-existing scan exacerbated by streaming cadence.
