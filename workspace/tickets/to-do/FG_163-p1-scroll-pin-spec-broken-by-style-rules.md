---
id: FG_163
title: "Restore scroll-pin E2E under STYLE_RULES short-reply contract"
date: 2026-05-07
type: fix
status: to-do
priority: p1
description: "The second test in chat-assistant-placeholder.spec.ts (keeps streaming replies pinned to bottom until the user scrolls away) has been failing reliably since 2026-04-29 because its prompt asks for an 80-line numbered list, a format the clone agent's system-prompt STYLE_RULES explicitly forbids. The persona refuses with a short conversational reply, the chat container does not overflow, and pixel-based scroll assertions time out. Pick one of four documented remediation paths and restore the spec to deterministic 3-of-3 green."
dependencies: []
acceptance_criteria:
  - "git grep -n 'Reply with exactly 80 numbered lines' apps/mirror/e2e/chat-assistant-placeholder.spec.ts returns 0 matches (the offending prompt is gone from the spec)."
  - "Either: pnpm --filter=@feel-good/mirror test:e2e chat-assistant-placeholder.spec.ts exits 0 on three consecutive runs from a clean checkout (test passes deterministically), OR the second test is wrapped in test.fixme(...) / test.skip(...) with an inline TODO comment that contains the literal string 'FG_163'."
  - "The first test (shows the assistant placeholder immediately on first and subsequent sends) still passes — the bridge-fix regression guard at chat-assistant-placeholder.spec.ts:224 (firstSendTracking.resolvingStateSeen === false) and the new symmetric assertion in the second-send block (secondSendTracking.resolvingStateSeen === false) are both green."
  - "STYLE_RULES at packages/convex/convex/chat/helpers.ts:66-69 is unchanged in body (Do not use bullet points, numbered lists, or headers. Keep replies short — usually 1–3 sentences.). Confirmed by: git diff main -- packages/convex/convex/chat/helpers.ts shows no edits to the STYLE_RULES export, OR if option C is chosen, the only edit adds an env-flag-gated bypass that does not modify the constant text."
  - "The chosen option (A/B/C/D) is documented in a header comment at the top of chat-assistant-placeholder.spec.ts referencing FG_163 and naming the option."
owner_agent: "E2E test stabilizer (Playwright + Convex chat agent familiarity)"
---

# Restore scroll-pin E2E under STYLE_RULES short-reply contract

## Context

`apps/mirror/e2e/chat-assistant-placeholder.spec.ts:248` (`"keeps streaming replies pinned to bottom until the user scrolls away"`) consistently times out at `waitForScrollGrowth` (line 176) with `Received: 0` for the polled `scrollHeight - baselineHeight` value. Three consecutive runs in the `fix-message-error` worktree on 2026-05-07 produced identical failures.

The test sends `longReplyMessage = "Reply with exactly 80 numbered lines in plain text. Each line must begin with 'stream line' followed by the line number. No intro or outro."` (line 8) and expects the chat container's `scrollHeight` to grow by more than 200px as the assistant streams 80 lines. The actual response captured at timeout in `apps/mirror/test-results/chat-assistant-placeholder-81c3b-until-the-user-scrolls-away-chromium/error-context.md` is the persona's complete reply:

> "I'm not able to follow that format — I'm here to have a real conversation, not generate filler content. Got a question about creativity, music, or the creative process? I'm all in for that."

Approximately 250 characters in one chat bubble — not enough to grow the container's `scrollHeight` past baseline (≈ 0px growth measured by `getScrollMetrics`). The streaming pipeline itself is healthy: `pendingAssistantSeen` flips true, `assistantTextSeen` flips true, the assistant text renders in the DOM. The fault is the test's content-volume premise.

The cause is `STYLE_RULES` at `packages/convex/convex/chat/helpers.ts:66-69`, introduced 2026-04-29 by commit `2ce9d224` (`feat(chat): clone agent replies in plain text, no markdown`):

```text
Write the way someone texts a friend. Plain conversational prose, no markdown.
Do not use **, *, _, or backticks for emphasis. Do not use bullet points, numbered lists, or headers.
Keep replies short — usually 1–3 sentences. If you need to mention multiple things, weave them into a sentence instead of listing them.
```

These rules are baked into every clone's system prompt via `composeSystemPrompt` (`helpers.ts:155-186`) and have higher precedence than user input. The persona is therefore correct to refuse; the test prompt was authored 2026-03-11 (commit `a092f4f1`) when models would happily produce structured filler content.

The test was added before the persona contract tightened. It has been intrinsically incompatible with the production system prompt for ~8 days. The bridge-fix branch is not the cause; this regression simply became visible during 3-run verification of that branch.

## Goal

The second test either passes deterministically against the production STYLE_RULES contract on three consecutive runs, or is explicitly marked `test.fixme(...)` with a TODO referencing this ticket so CI is unblocked. Either way, the offending 80-numbered-lines prompt is removed from the spec and the chosen path is documented in the file's header.

## Scope

- Pick one of options A, B, C, D below.
- Apply the chosen option to `apps/mirror/e2e/chat-assistant-placeholder.spec.ts` (and to chat-helper files only if option C).
- Update the header comment of the spec to name the option and reference FG_163.
- Run the spec 3× to confirm stability under the chosen path.

## Out of Scope

- Changing `STYLE_RULES` text or relaxing the persona contract globally. The product behavior (short conversational replies, no lists) is intentional and load-bearing for the clone persona surface.
- The first test (`"shows the assistant placeholder immediately on first and subsequent sends"`) — it passes 3/3 and verifies the route-controller bridge fix. Do not touch.
- The bridge fix on `fix-message-error` (`chat-route-controller.tsx`, the `pendingNewConversationId` mechanic). Independently verified.
- Other e2e specs that may incidentally rely on long replies (none confirmed yet — investigate only if the chosen option needs to validate broader fallout).

## Approach

Four candidate remediations. The owner picks one based on the cost/coverage tradeoff that fits the team's appetite:

**Option A — Replace prompts with multi-item prose questions; lower thresholds.**
Swap `longReplyMessage` and `detachedReplyMessage` for organic open-ended prompts (e.g., "Tell me about three of your favorite records and what made each one special. Be specific.") and lower `waitForScrollGrowth`'s `>200` to `>40`, and `distanceFromBottom > 200` to `>100` (just above `AUTO_SCROLL_THRESHOLD_PX = 96` from `chat-message-list.tsx:12`). Cheapest. Risk: organic LLM replies are non-deterministic in length; may flake.
- Effort: Small. Risk: Medium.

**Option B — Redesign: build up scroll content with several short messages first.**
Send 4–6 short user prompts at the start of the test to push chat content past the panel viewport (≈ 600–700px), then test pin/un-pin behavior on the next streamed message. Most robust against STYLE_RULES because it doesn't rely on any single reply being long. Largest diff.
- Effort: Medium. Risk: Low.

**Option C — Add an env-gated test-mode that bypasses STYLE_RULES.**
Mirror the existing pattern at `packages/convex/convex/chat/testHelpers.ts:1-37` (PLAYWRIGHT_TEST_SECRET-gated `internalMutation`). Add a flag (e.g., `composeSystemPrompt({ ..., bypassStyleRules })`) wired through a Next API route reachable only with the secret. The spec sets the flag, sends `longReplyMessage`, gets a real long reply. Loses end-to-end coverage of the production prompt path; preserves deterministic streaming/pin behavior coverage.
- Effort: Medium. Risk: Medium (introduces a divergent prompt path that must be tested separately).

**Option D — Skip the test with `.fixme()`, file follow-up.**
`test.fixme("FG_163: incompatible with STYLE_RULES — pending redesign", ...)`. Lowest immediate effort. Sacrifices coverage of the scroll-pin streaming behavior until A/B/C ships.
- Effort: Trivial. Risk: Low (zero coverage during the gap).

Recommendation: **Option B** has the best long-term cost/coverage tradeoff and is consistent with how the test was conceptually designed (verifying scroll behavior at scale). **Option D** is the right answer if there's no immediate appetite for the redesign and the team would rather ship the bridge fix without this noise.

- Effort: depends on chosen option (Trivial → Medium).
- Risk: depends on chosen option (Low → Medium).

## Implementation Steps

1. Decide A / B / C / D. If unclear, default to D (skip + ticket-linked TODO) and re-open under a follow-up ticket.
2. Apply the chosen option to `apps/mirror/e2e/chat-assistant-placeholder.spec.ts`. Specifics:
   - Option A: replace lines 7–10 (the two long-reply prompt constants) with organic multi-item prompts; update lines 260 and 291 (`toContainText` expectations) to match new substrings; change `waitForScrollGrowth`'s `200` (line 179) to `40`; change `distanceFromBottom > 200` (lines 283, 302) to `> 100`.
   - Option B: add a helper `await primeScrollHistory(textarea, page)` that sends 4–6 short prompts and waits for each to settle before the test's existing assertions; keep the streaming-message structure but replace the long-list prompts with single-sentence organic questions.
   - Option C: add a `bypassStyleRules` flag to `composeSystemPrompt` (`packages/convex/convex/chat/helpers.ts`); add a test-only mutation that toggles it, gated by `PLAYWRIGHT_TEST_SECRET` (mirror `testHelpers.ts:14`); set the flag from the spec's `beforeAll`; restore in `afterAll`.
   - Option D: wrap the second test in `test.fixme("FG_163: …", async ({ page }) => { … })`. Leave the body intact for the future fix.
3. Add a header comment at the top of `chat-assistant-placeholder.spec.ts` (above the imports) naming the chosen option and the FG_163 reference. Format: `// FG_163 (Option <X>): <one-line explanation>`.
4. Run `pnpm --filter=@feel-good/mirror test:e2e chat-assistant-placeholder.spec.ts` three times in a row. All three must exit 0. If any flake, return to step 1 (pick a different option).
5. Run `pnpm --filter=@feel-good/mirror lint` and `pnpm --filter=@feel-good/mirror build` — both must exit 0.
6. Update this ticket with the chosen option in a `## Resolution` section, then move the file to `workspace/tickets/completed/`.

## Constraints

- Do NOT modify `STYLE_RULES` body text. The clone persona contract is the trust boundary — relaxing it for any reason other than test-only-with-secret-flag is out of scope.
- Do NOT regress the first test in this spec. The bridge-fix regression guard depends on it being green.
- Do NOT introduce a parallel "test prompt path" that doesn't exercise the same code path as production unless Option C is chosen and the path is fully gated by `PLAYWRIGHT_TEST_SECRET`.
- Keep the spec file editable by humans — do not generate prompts at runtime from configuration; keep the prompt strings inline so a reviewer can read them.

## Resources

- Failing test source: `apps/mirror/e2e/chat-assistant-placeholder.spec.ts:248-313`.
- Captured failure evidence: `apps/mirror/test-results/chat-assistant-placeholder-81c3b-until-the-user-scrolls-away-chromium/error-context.md`.
- Persona contract: `packages/convex/convex/chat/helpers.ts:62-72` (SAFETY_PREFIX) and `:66-69` (STYLE_RULES).
- System-prompt composition: `packages/convex/convex/chat/helpers.ts:155-186` (`composeSystemPrompt`).
- Existing test-bypass pattern (for option C): `packages/convex/convex/chat/testHelpers.ts:14` (`exhaustAnonDailyBucket`, gated by `PLAYWRIGHT_TEST_SECRET`).
- Scroll threshold constant: `apps/mirror/features/chat/components/chat-message-list.tsx:12` (`AUTO_SCROLL_THRESHOLD_PX = 96`).
- Regression-introducing commit: `2ce9d224 feat(chat): clone agent replies in plain text, no markdown` (2026-04-29).
- Prompt-introducing commit: `a092f4f1 Extract MirrorLogo component from profile panel (#194)` (2026-03-11) — the prompt was added in this PR's predecessor.
