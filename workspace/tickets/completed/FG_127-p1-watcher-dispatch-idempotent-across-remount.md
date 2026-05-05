---
id: FG_127
title: "Clone-agent navigation dispatches once per tool call across remount, conversation switch, and panel reopen"
date: 2026-05-05
type: fix
status: completed
priority: p1
description: "useAgentIntentWatcher's idempotency Set lives in a useRef whose lifetime is tied to ChatActiveThread's mount. When the user closes and reopens the chat panel, switches to an existing conversation, or otherwise causes the component to remount, the Set is fresh — and the persisted UIMessages re-deliver every historical navigateToContent tool result, hijacking the user to that historical URL. The dispatch contract must hold across remounts, not just within a single mount lifetime. Add a vitest unit suite for the hook."
dependencies: []
parent_plan_id: docs/plans/2026-05-04-feat-agent-ui-parity-plan.md
acceptance_criteria:
  - "A vitest test in `apps/mirror/features/chat/hooks/__tests__/use-agent-intent-watcher.test.ts` simulates two mounts of the hook with the same persisted message containing a completed navigateToContent tool part, and asserts navigateToContent is dispatched exactly once across both mount cycles"
  - "A vitest test feeds a UIMessage with a tool part in `state: 'input-streaming'` and asserts navigateToContent is NOT called"
  - "A vitest test feeds the same message array twice within one mount and asserts dispatch happens exactly once"
  - "`grep -n 'use-agent-intent-watcher.test' apps/mirror/features/chat/hooks/__tests__/` shows the new test file present"
  - "Manually closing and reopening the chat panel (Chrome MCP, with a previously-navigated conversation) does NOT cause the URL to jump to the historical content URL on reopen — the URL stays where the user was"
  - "`pnpm --filter=@feel-good/mirror test:unit` passes including the new tests"
  - "`pnpm build --filter=@feel-good/mirror` and `pnpm lint --filter=@feel-good/mirror` both pass"
owner_agent: "Mirror frontend developer (chat feature)"
---

# Clone-agent navigation dispatches once per tool call across remount, conversation switch, and panel reopen

## Context

Code review on `feature-agent-parity-architecture` (correctness, agent-native, and concurrency reviewers — three independent reviewers converged) found that `useAgentIntentWatcher`'s idempotency guarantee is mount-scoped, not conversation-scoped or session-scoped.

`apps/mirror/features/chat/hooks/use-agent-intent-watcher.ts:71`:

```ts
const handledToolCallIdsRef = useRef<Set<string>>(new Set());
```

The Set is initialized once per mount of `ChatActiveThread` (which contains the watcher). The watcher's effect walks all messages on every change to the `messages` prop and dispatches any `tool-navigateToContent` part with `state === "output-available"` whose `toolCallId` is not already in the Set.

Three distinct lifecycle events break the "dispatch once per tool call" contract:

1. **Panel close → reopen.** `ChatActiveThread` unmounts when `isChatOpen` flips to false (it lives inside `ChatPanel`). On reopen, the Set is empty, `useUIMessages` re-delivers persisted assistant messages including any historical `tool-navigateToContent` parts → all of them dispatch again. The user's URL jumps to whichever historical tool call was last in the list.
2. **Conversation switch via the conversation list.** Switching to an existing conversation that previously had a navigateToContent tool result delivers those persisted messages to a Set that has never seen the historical toolCallIds.
3. **Future Phase 2 mount migration.** The watcher's own JSDoc (lines 38-47) says Phase 2 will move the watcher to a permanent mount — making the persisted-replay attack vector even more reachable, because remount no longer cleans the Set.

The hook also ships with **zero unit tests**. The e2e at `apps/mirror/e2e/chat-agent-navigates.authenticated.spec.ts` exercises the round-trip with a real LLM, but it does not isolate the idempotency invariant — if the LLM ever stops calling the tool, the e2e silently regresses to passing.

## Goal

A `tool-navigateToContent` result is dispatched exactly once per `toolCallId`, across the entire conversation lifetime — regardless of how many times the panel closes/reopens, the user switches conversations, or the watcher mounts and unmounts. The invariant is pinned by unit tests that re-feed the same messages across simulated remount cycles.

## Scope

- Persist the handled `toolCallId` set across mounts (not just within one mount). The simplest shape: a module-level `Map<conversationId, Set<toolCallId>>` initialized lazily, or a `sessionStorage` key keyed by conversationId.
- Reset the per-conversation entry only when the conversation is genuinely new (e.g., when `setConversationId(null)` resolves to a fresh thread).
- Add `apps/mirror/features/chat/hooks/__tests__/use-agent-intent-watcher.test.ts` covering: (a) re-render within one mount dispatches once, (b) remount with same messages dispatches zero additional times, (c) `state: "input-streaming"` is never dispatched, (d) `state: "output-error"` is never dispatched, (e) two distinct `toolCallId`s in one assistant turn each dispatch once.
- Update the JSDoc in `use-agent-intent-watcher.ts:38-47` to remove the "Phase 1 limitation" disclaimer once the persistence is in place.

## Out of Scope

- The Phase 2 migration to a permanent mount point (separate ticket; the persistence fix here makes Phase 2 safer but does not require it).
- The "user closes panel mid-stream → tool result lost" direction. That is a *drop*, not a *replay*, and is the dominant flow's documented Phase-1 limitation. File separately if it remains a UX problem after this fix lands.
- The unrelated stability issues with `navigateToContent` re-allocating per render (P2 follow-up — `buildChatAwareHref` callback ref pattern).
- Multiple `tool-navigateToContent` calls in one turn — last router.push wins. P3, separate.

## Approach

Module-level `WeakMap` keyed by conversationId is too aggressive (GC clears it). Use a plain `Map<string, Set<string>>` exported from the hook's module, initialized once. The hook reads the entry for its current conversationId via a parameter (or via `useChatContext().conversationId`), creates an entry on first use, and adds toolCallIds to it on dispatch.

Memory bound: each toolCallId is ~36 chars (UUID). A power user with 1000 tool calls across all conversations = ~36 KB. Acceptable.

Alternative: `sessionStorage` keyed by conversationId. Works across reloads but adds a sync layer. The plain Map is simpler and the persisted-toolCallId in Convex makes reload replay a separate concern (a fresh page load + the persisted messages would still need this Map's per-tab equivalent — but the e2e against `?chat=1&conversation=` shows that on reload, the URL state already controls navigation, so reload-replay isn't actually a new bug).

The unit test mounts the hook via `renderHook`, calls it with a mock messages array, then unmounts and re-renders with the same messages — asserting that the mock `navigateToContent` was called exactly once across both mounts.

- **Effort:** Medium
- **Risk:** Medium (touches a hot dispatch path; needs careful unit coverage to avoid regressions)

## Implementation Steps

1. In `apps/mirror/features/chat/hooks/use-agent-intent-watcher.ts`, define a module-level `const handledByConversation = new Map<string, Set<string>>()` outside the hook function.
2. Change the hook signature to accept `conversationId: string | null` (or read it from `useChatContext()` — match the existing pattern in the file).
3. Inside the hook, replace the per-mount `useRef(new Set())` with a function that retrieves or creates the Set for the current conversationId from the module Map.
4. Keep the `state === "output-available"` check and the `Set.has(toolCallId)` skip identical.
5. Update the JSDoc at lines 38-47 to remove the Phase 1 mount-limitation disclaimer; replace with a one-line description of the conversation-scoped Map.
6. Update the call site in `apps/mirror/features/chat/components/chat-thread.tsx:104` to pass `conversationId` (or remove the prop if the hook reads it from context).
7. Create `apps/mirror/features/chat/hooks/__tests__/use-agent-intent-watcher.test.ts` with test cases (a)-(e) listed in Scope.
8. Use `@testing-library/react`'s `renderHook` for mount/unmount simulation; mock `useCloneActions` via a vi.fn.
9. Run `pnpm --filter=@feel-good/mirror test:unit` and confirm all new cases pass.
10. Manual Chrome MCP verification: open a chat, ask "show me your latest article", let it navigate, close the chat panel, reopen — confirm the URL does NOT re-jump to the article.

## Constraints

- Do not introduce a Convex-side persistence layer for the handled set. This is client-only state.
- Do not call `Map.delete()` on conversationId entries unless the conversation is deleted — switching back to a conversation should remember its handled IDs.
- Keep the dispatch synchronous inside the effect — do not move it to a `setTimeout` or microtask (per `react-components.md`).
- The hook signature change must not require updates to any file other than `chat-thread.tsx`.

## Manual Verification

The unit tests cover idempotency. The user-visible bug ("URL jumps after reopen") needs a Chrome MCP smoke:

1. Open `localhost:3001/@rick-rubin?chat=1`.
2. Send "show me your latest article."
3. Wait for navigation to `/@rick-rubin/articles/<slug>`.
4. Close the chat panel via the close button.
5. Reopen the chat panel.
6. Confirm the URL does NOT change on reopen — it stays at the article you navigated to (or wherever the user was when reopening).

Before the fix, step 6 fails (URL re-jumps). After the fix, it passes.

## Resources

- `.claude/rules/agent-parity.md` § Footguns: "Watcher idempotency. Tool-result parts re-render many times during streaming and after persistence. Track handled toolCallIds in a ref so a single tool call dispatches navigation exactly once."
- Code review report from `/review-code` on `feature-agent-parity-architecture` (2026-05-05) — P1 cluster 4 (replay) + P1 cluster 5 (no unit test)
- `apps/mirror/features/chat/hooks/use-agent-intent-watcher.ts:38-47` (current Phase-1 disclaimer)
- `apps/mirror/e2e/chat-agent-navigates.authenticated.spec.ts` (existing e2e, not a substitute for the unit suite)
