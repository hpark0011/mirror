---
id: FG_262
title: "Agent intent watcher does not replay tool navigation in configuration mode"
date: 2026-05-22
type: fix
status: completed
priority: p1
description: "Branch hpark0011/post-edit-route-error fixes one entry point — ChatRouteController no longer auto-selects the latest persisted configuration conversation on chat open. But useAgentIntentWatcher (apps/mirror/features/chat/hooks/use-agent-intent-watcher.ts) is invoked unconditionally from ChatActiveThread (apps/mirror/features/chat/components/chat-thread.tsx:122) with no chatMode awareness. Its idempotency Map (handledByConversation) is module-scoped and clears on tab close or full reload. So an owner who explicitly resumes a saved configuration conversation — via the conversations list sheet, a shared/bookmarked ?conversation=<id>&chatMode=configuration URL, or browser back/forward — still triggers the historical tool-result replay the 2026-05-22 lessons.md entry warns about, landing them on stale content URLs. The fix is to make the watcher itself mode-aware: skip all navigation dispatch when chatMode === 'configuration'."
dependencies: []
acceptance_criteria:
  - "useAgentIntentWatcher does not dispatch ANY navigation (navigateToContent / navigateToProfileSection / navigateToEditor) when chatMode === 'configuration', regardless of how the conversationId was supplied."
  - "Clone mode behavior is unchanged: tool-result parts with state === 'output-available' still dispatch the matching navigation exactly once per (conversationId, toolCallId)."
  - "A new unit test in apps/mirror/features/chat/hooks/__tests__/use-agent-intent-watcher.test.ts mounts the watcher with chatMode='configuration' AND a messages array containing completed applyBioEntryPatch + applyContentPatch tool-result parts, and asserts navigateToProfileSection / navigateToContent / navigateToEditor are NEVER called."
  - "A second new unit test in the same file mounts with chatMode='clone' and the same fixture, and asserts the corresponding dispatcher methods ARE called exactly once each (regression guard for the gate)."
  - "The existing tests in use-agent-intent-watcher.test.ts continue to pass without modification — the new chatMode arg defaults or threads through in a way that preserves existing call sites."
  - "pnpm --filter=@feel-good/mirror test:unit passes (all 38 files / 341+ cases plus the two new ones)."
  - "pnpm --filter=@feel-good/mirror lint passes."
---

# Agent intent watcher does not replay tool navigation in configuration mode

## Context

Branch `hpark0011/post-edit-route-error` ships a partial fix for the bug described in `workspace/lessons.md` (2026-05-22): the owner opens Configure Profile chat and is silently navigated to a stale content URL because persisted tool-result parts re-dispatch through `useAgentIntentWatcher`.

The current fix lives in `apps/mirror/app/[username]/_providers/chat-route-controller.tsx:113` — it skips auto-selecting the latest configuration conversation when chat opens without an explicit `?conversation=`. That suppresses the most common path. But:

1. `apps/mirror/features/chat/components/chat-thread.tsx:122` calls `useAgentIntentWatcher(messages, conversationId)` unconditionally for any mounted `ChatActiveThread`.
2. The watcher (`apps/mirror/features/chat/hooks/use-agent-intent-watcher.ts`) has no `chatMode` parameter and no mode awareness.
3. Its idempotency authority is the module-level `handledByConversation: Map<string, Set<string>>` at line 71 — explicitly documented as "memory bound: each toolCallId is ~36 chars (UUID). 1000 tool calls across all conversations ≈ 36 KB. Acceptable for a tab's lifetime." That Map clears on tab close, full reload, or fresh browser session.

So the bug still reproduces whenever any of these happen:

- Owner opens the conversations-list sheet (`ChatConversationListSheet`) and explicitly selects a saved configuration conversation.
- Owner arrives via a bookmarked or shared link with `?conversation=<config_id>&chatMode=configuration`.
- Owner uses browser back/forward to return to a configuration conversation.
- Owner reloads the tab while a configuration conversation is open.

In all four cases `routeResolution` lands on `{ status: 'ready', conversationId: <config_id> }` via the `effectiveConversationId` branch — completely bypassing the new auto-select guard — and the watcher walks the persisted `applyBioEntryPatch` / `applyContentPatch` / `applyContactEntryPatch` / `applyProjectPatch` tool results, treating each as fresh because `handledByConversation` is empty on first mount.

The root-cause fix is to gate the watcher itself, not the controller. Pass `chatMode` into `useAgentIntentWatcher` (or have it read from a chat context) and early-return the navigation dispatch loop when mode is `configuration`.

## Scope

- Add a `chatMode` parameter to `useAgentIntentWatcher` (or have it consume `useChatSearchParams`/equivalent context internally).
- Early-return the dispatch loop when `chatMode === 'configuration'`. Do NOT clear `handledByConversation` — the Map remains the cross-mount idempotency authority for clone mode.
- Update the single call site in `chat-thread.tsx:122` to pass `chatMode`.
- Add two new unit tests in `use-agent-intent-watcher.test.ts` covering both halves (configuration → no dispatch; clone → dispatches once).

## Approach

Pick the simplest API shape: thread `chatMode` through as a third positional argument. The hook is consumed in exactly one place, so the prop-drilling cost is one line. Reading from a context inside the hook would couple the watcher to the chat search-params context and complicate the existing test fixtures.

```ts
// apps/mirror/features/chat/hooks/use-agent-intent-watcher.ts
import { type ChatMode } from "@/features/chat";

export function useAgentIntentWatcher(
  messages: UIMessage[],
  conversationId: string | null,
  chatMode: ChatMode,
) {
  const { navigateToContent, navigateToProfileSection, navigateToEditor } =
    useCloneActions();
  const lastScannedIndexRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (chatMode === "configuration") return; // skip historical tool-result replay
    if (messages.length === 0) return;
    // …existing loop unchanged…
  }, [
    messages,
    navigateToContent,
    navigateToProfileSection,
    navigateToEditor,
    conversationId,
    chatMode,
  ]);
}
```

Place the `chatMode === 'configuration'` guard above the `messages.length === 0` guard so a configuration-mode mount with messages already loaded short-circuits without paying for the message walk. Add `chatMode` to the dep array so a mid-session mode switch re-evaluates (cheap, and pinned by test).

Call site update is one line:

```tsx
// apps/mirror/features/chat/components/chat-thread.tsx:122
useAgentIntentWatcher(messages, conversationId, chatMode);
```

`chatMode` is already in scope at the call site via `useChatSearchParams()` / context (verify before editing).

## Implementation Steps

1. Read `apps/mirror/features/chat/components/chat-thread.tsx` around line 122 to confirm `chatMode` is already in scope (it should be — `ChatActiveThread` consumes the route controller / search-params context already). If not, pull it from `useChatRouteController()` or `useChatSearchParams()` whichever is closer.
2. Add the third `chatMode: ChatMode` parameter to `useAgentIntentWatcher` (`apps/mirror/features/chat/hooks/use-agent-intent-watcher.ts:350-353`). Import `ChatMode` from `@/features/chat`.
3. Add `if (chatMode === "configuration") return;` as the first guard in the effect body, above `if (messages.length === 0) return;` (current line 376).
4. Add `chatMode` to the effect dep array (currently `[messages, navigateToContent, navigateToProfileSection, navigateToEditor, conversationId]` at line 564).
5. Update the single call site at `apps/mirror/features/chat/components/chat-thread.tsx:122` to pass `chatMode` as the third argument.
6. Add two new test cases to `apps/mirror/features/chat/hooks/__tests__/use-agent-intent-watcher.test.ts`:
   - Configuration mode + completed `applyBioEntryPatch` and `applyContentPatch` parts → asserts `navigateToProfileSection`, `navigateToContent`, and `navigateToEditor` were never called.
   - Clone mode + the same fixture → asserts each dispatcher was called exactly once (or whatever the existing test convention is for "called for this part type").
   Use the existing test file's mock shape; do not re-roll mocks.
7. Run `pnpm --filter=@feel-good/mirror test:unit -- run use-agent-intent-watcher` and confirm both new tests pass and the existing tests are green.
8. Run `pnpm --filter=@feel-good/mirror test:unit` and `pnpm --filter=@feel-good/mirror lint` to confirm no collateral breakage.
9. After the fix lands, the partial fix on `hpark0011/post-edit-route-error` (the `ChatRouteController` auto-select guard) remains as defense in depth — do NOT revert it.

## Out of Scope

- Changing `handledByConversation`'s storage shape (no localStorage, no persistence across reloads). The watcher is the gate; the Map's session scope is appropriate for clone-mode replay protection within a tab.
- Adding a separate `useConfigurationIntentWatcher` for configuration tool results. Today there is no per-tool navigation needed in configuration mode after the patch — the configuration agent's job is to mutate, and the owner sees a fresh composer.
- Modifying the auto-select fix in `chat-route-controller.tsx`. That guard remains as defense in depth.
- Touching the conversations-list sheet UI or the URL routing — the watcher gate is the correct single point of control.

## Constraints

- The `handledByConversation` Map must NOT be touched. It is the cross-mount idempotency authority for clone mode and changing its semantics would risk re-introducing duplicate clone-mode navigation.
- The guard must run BEFORE `messages.length === 0` so the configuration short-circuit is cheap. Do not put it inside the for-loop.
- The new tests must use the existing mock pattern for `useCloneActions` (the test file already mocks it). Do not introduce a second mock framework.

## Resources

- `workspace/lessons.md` (2026-05-22) — "Configuration chat should not auto-select old conversations on open" — names `useAgentIntentWatcher` as the replay vector.
- `apps/mirror/app/[username]/_providers/chat-route-controller.tsx:107-130` — the partial fix this ticket completes.
- `apps/mirror/features/chat/hooks/use-agent-intent-watcher.ts` — the watcher.
- `apps/mirror/features/chat/components/chat-thread.tsx:122` — the single call site.
- `.claude/rules/agent-parity.md` — the watcher is the agent half of the two-routes-one-dispatcher pattern; touching it should preserve that contract.
- Code review report on `hpark0011/post-edit-route-error` — Finding #2 (P1, agent-native).
