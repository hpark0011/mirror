---
id: FG_132
title: "Chat-agent navigation e2e negative path proves the assistant actually responded"
date: 2026-05-05
type: improvement
status: to-do
priority: p2
description: "The negative-path test in chat-agent-navigates.authenticated.spec.ts asserts the URL did not change AND that a received-bubble appeared. The current selector matches the bubble container element (`[data-slot=chat-message-bubble]`), which is satisfied by an empty placeholder bubble that renders before the stream completes. A regression where the agent times out or the LLM emits an empty response would still pass the assertion. Tighten the selector to require non-empty text content so the test genuinely proves the agent responded."
dependencies: []
parent_plan_id: docs/plans/2026-05-04-feat-agent-ui-parity-plan.md
acceptance_criteria:
  - "The negative-path assertion at `apps/mirror/e2e/chat-agent-navigates.authenticated.spec.ts:144` verifies non-empty text content (e.g., `await expect(bubble).toHaveText(/\\S+/)` or equivalent non-empty matcher) in addition to `toBeVisible()`"
  - "Regression-proof: temporarily render an empty bubble shell (no streamed content) and run the spec — the negative path test fails. Revert the temporary change."
  - "The positive path test continues to pass (the URL navigation assertion is the load-bearing check there; bubble assertion is not part of that path)"
  - "`pnpm --filter=@feel-good/mirror exec playwright test apps/mirror/e2e/chat-agent-navigates.authenticated.spec.ts` passes against the live LLM"
  - "The selector helper `RECEIVED_BUBBLE_SELECTOR` in `apps/mirror/e2e/helpers/chat.ts` is unchanged (no signature change at the helper level)"
owner_agent: "Mirror frontend developer (e2e)"
---

# Chat-agent navigation e2e negative path proves the assistant actually responded

## Context

Code review on `feature-agent-parity-architecture` (tests reviewer, P2 0.72) flagged that the negative-path e2e assertion is too loose to distinguish "agent recovered with text" from "agent never replied at all."

`apps/mirror/e2e/chat-agent-navigates.authenticated.spec.ts:138-146`:

```ts
// Prove the LLM actually replied — without this, "URL didn't change"
// could mean either (a) the tool was called and `resolveBySlug` blocked
// the cross-user navigation, or (b) the agent never tried at all. The
// received-bubble assertion combined with the URL-unchanged check
// triangulates the intended outcome: the agent responded *and* did not
// navigate.
await expect(page.locator(RECEIVED_BUBBLE_SELECTOR).last()).toBeVisible({
  timeout: NAVIGATION_TIMEOUT,
});
```

`RECEIVED_BUBBLE_SELECTOR` (in `apps/mirror/e2e/helpers/chat.ts`) targets the bubble container element. `toBeVisible()` passes if the container exists and has non-zero size — even when its inner text is empty (the loading shell, an interrupted stream, or a placeholder rendered before the first delta arrives).

The author's intent is clear from the comment: prove the agent responded with text. The implementation falls short. A regression where the LLM throws or the stream cancels before any token arrives would still render the bubble shell and pass the assertion. The cross-user negative invariant (no URL pivot) holds for the wrong reason.

## Goal

The negative-path test fails when the assistant did not produce any text content, regardless of whether the bubble shell rendered. The combination "URL unchanged AND assistant text present" is a true conjunction.

## Scope

- Update the bubble assertion at `chat-agent-navigates.authenticated.spec.ts:144` to assert non-empty text content. Either:
  - `await expect(bubble).toHaveText(/\S+/)` (matches any non-whitespace), OR
  - `await expect(bubble).not.toHaveText("")` (rejects truly-empty), OR
  - A custom helper `expectBubbleHasContent(bubble)` if reused elsewhere.
- Optionally update the inline comment to note the assertion now verifies content.
- Do NOT change `RECEIVED_BUBBLE_SELECTOR` itself — its current shape is correct for locating the bubble; only the assertion on the located element needs tightening.

## Out of Scope

- Changing the positive-path test — it asserts URL navigation, which is the load-bearing check there.
- Changing the LLM prompt strings (`positivePrompt`, `negativePrompt`) — they're working as intended.
- Reducing the test timeouts.
- Adding new e2e specs for unrelated agent behaviors.

## Approach

Playwright's `toHaveText(/\S+/)` is the simplest match. It auto-retries within the assertion's timeout (inheriting from `NAVIGATION_TIMEOUT` if specified), so streaming completion is handled naturally — the assertion polls until the element has any non-whitespace content or times out.

Concrete change:

```ts
// Before
await expect(page.locator(RECEIVED_BUBBLE_SELECTOR).last()).toBeVisible({
  timeout: NAVIGATION_TIMEOUT,
});

// After
const bubble = page.locator(RECEIVED_BUBBLE_SELECTOR).last();
await expect(bubble).toBeVisible({ timeout: NAVIGATION_TIMEOUT });
await expect(bubble).toHaveText(/\S+/, { timeout: NAVIGATION_TIMEOUT });
```

Two assertions: first that the bubble exists (the existing loose check, now a sanity step), then that its text is non-empty. This preserves the semantic separation in the test: bubble appearance vs. bubble has content.

- **Effort:** Small
- **Risk:** Low — Playwright's auto-retry behavior handles the streaming-completion timing for us.

## Implementation Steps

1. Open `apps/mirror/e2e/chat-agent-navigates.authenticated.spec.ts`.
2. Replace the single `toBeVisible` assertion at line 144 with the two-step shape (visible + has-content).
3. Update the inline comment at lines 138-143 to reflect the new content assertion.
4. Run `pnpm --filter=@feel-good/mirror exec playwright test apps/mirror/e2e/chat-agent-navigates.authenticated.spec.ts` against the live Anthropic-backed LLM.
5. Regression-proof: temporarily intercept the LLM call to return an empty response (or render an empty bubble in dev), re-run the spec, confirm the negative-path test fails. Revert.
6. Run `pnpm build --filter=@feel-good/mirror` and `pnpm lint --filter=@feel-good/mirror` to confirm no incidental drift.

## Constraints

- Use `RECEIVED_BUBBLE_SELECTOR` from `helpers/chat.ts` — do not introduce a parallel selector.
- Do not relax `NAVIGATION_TIMEOUT` — keep the 60s ceiling for cold-start LLM latency.
- The positive-path test at lines 74-110 must continue to assert URL transition; do not migrate the bubble check there.

## Manual Verification

This change is exercised by Playwright with a real LLM. CI or local runs against the production Anthropic key are the standard verification surface. No separate Chrome MCP step required.

## Resources

- `.claude/rules/testing.md` (Playwright CLI is the e2e tool)
- Code review report from `/review-code` on `feature-agent-parity-architecture` (2026-05-05) — P2 #7
- Playwright docs on `toHaveText`: https://playwright.dev/docs/api/class-locatorassertions#locator-assertions-to-have-text
- Peer specs that use the same bubble selector: `apps/mirror/e2e/chat-plain-text.spec.ts`, `apps/mirror/e2e/chat-assistant-placeholder.spec.ts`
