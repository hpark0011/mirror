# Plan — Stop the full-panel loading flash when sending the first message in a new chat

**Date:** 2026-05-06 **Branch:** `fix-message-error` **Scope:** A single fix in `chat-route-controller.tsx` to bridge the URL-update gap during new-conversation creation. No backend, schema, or chat-tool changes.

---

## Goal

When a user submits the **first** message in a new chat conversation, the chat panel currently:

1. Shows the submitted user bubble + a brief assistant placeholder ("book flip" thinking animation) — correct.
2. Then collapses the entire chat panel into the full-height ArcSphere loading sphere — wrong.
3. Then re-renders the message thread with the streamed reply.

After this fix, step 2 must not happen. The user bubble + assistant placeholder should remain mounted continuously until the streamed assistant tokens replace the placeholder. The second-message and subsequent-message paths already behave correctly and must not regress.

---

## Root cause (verified via Chrome MCP repro on `fix-message-error` branch, 2026-05-06)

A `MutationObserver` capture of `data-slot` transitions on the live page during a first send produced this timeline:

| t (ms) | empty | loading | scroll | msgs | URL has `conversation=` | What this is |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | ✓ | – | – | 0 | no | `ChatMessageEmptyState` (no conversation yet) |
| 8038 | – | – | ✓ | 2 | **no** | Optimistic user + pending-assistant rendered inside `ChatActiveThread` |
| 8740 | – | – | – | 0 | **no** | **None of the** `chat-message-*` **slots present** — `ChatThread` early-returned its `"resolving"` branch (`<ArcSphere />` with no data-slot). `ChatActiveThread` has unmounted. |
| 10608 | – | ✓ | – | 0 | yes | `ChatActiveThread` re-mounted; `useChatMessages` is `LoadingFirstPage` → `ChatMessageLoadingState` slot |
| 11560 | – | – | ✓ | 2 | yes | First page loaded; real messages render |

The mechanical chain:

1. `useChatSend.sendMessage` (`apps/mirror/features/chat/hooks/use-chat-send.ts:89-117`) calls `beginOptimistic(content)` and then `await sendMessageMutation(...)`. The mutation commits server-side.
2. After `await`, `markCreatedConversation(result.conversationId)` synchronously sets `createdConversationRef.current` inside `useChatOptimistic`. Then `onConversationCreated(result.conversationId)` calls the parent's `handleConversationIdChange(newId)`.
3. `handleConversationIdChange` in `apps/mirror/app/[username]/_providers/chat-route-controller.tsx:68-79` calls `setNewConversationIntent(false)` and `setConversation(newId)`. `setConversation` is `router.replace(...)` from `apps/mirror/hooks/use-chat-search-params.ts:29-37` — the URL update is **async**; `searchParams.get("conversation")` keeps returning `null` for one or two renders.
4. **Meanwhile, the Convex reactive query in** `useConversations` **already shipped the new conversation row to the client.** So `conversations.length` flipped `0 → 1`.
5. On the next render, `routeResolution` (`chat-route-controller.tsx:101-114`) sees: `conversationId` from URL is still `null`, `newConversationIntent` is `false`, `conversations.length > 0` → returns `{ status: "resolving" }`.
6. `ChatThread` (`apps/mirror/features/chat/components/chat-thread.tsx:18-34`) takes the `"resolving"` early return and renders just `<ChatHeader />` + `<ArcSphere />`. `ChatActiveThread` **unmounts.** All `useChatOptimistic` state — `optimisticMessages`, `pendingAssistantMessage`, `createdConversationRef`, the count baselines — is destroyed.
7. The router state-update flushes; `searchParams.get("conversation")` now returns the new id; `routeResolution` becomes `{ status: "ready", conversationId }`.
8. `ChatActiveThread` **re-mounts** with the new `conversationId`. `useChatMessages` → `useUIMessages` subscribes for the first time → `status === "LoadingFirstPage"`. `useChatOptimistic.resolvedStatus` (`use-chat-optimistic.ts:156-162`) cannot override the status to `"Exhausted"` because there is no longer any `optimisticMessages` or `pendingAssistantMessage` (they died with the unmount). `ChatMessageList` (`chat-message-list.tsx:218-220`) renders `ChatMessageLoadingState`.
9. First page returns; messages render.

The `createdConversationRef` ↔ conversation-switch-effect handshake at `use-chat-optimistic.ts:176-188` was specifically designed to preserve optimistic state when `conversationId` changes from `null` to the just-created id. It works only if `useChatOptimistic` itself stays mounted across the transition. The root cause is that `ChatThread`'s `routeResolution === "resolving"` early return unmounts the entire active subtree, defeating that handshake.

The reason the **second** message does not flash: by then `routeResolution.status` is already `"ready"`; the `conversations.length > 0 → resolving` branch is unreachable because the earlier `if (conversationId)` short-circuits. Confirmed by the same Chrome MCP repro on the second send (only 2 transitions: `2 msgs → 4 msgs`, no resolving/loading state in between).

There is already an existing E2E regression guard at `apps/mirror/e2e/chat-assistant-placeholder.spec.ts:210` and `:230`:

```ts
expect(firstSendTracking.chatLoadingStateSeen).toBe(false);
expect(secondSendTracking.chatLoadingStateSeen).toBe(false);
```

That guard targets the exact bug. After this fix, both lines must be reliably green on the first send.

---

## The fix

Bridge the URL-update gap with a one-render-tick local state in `chat-route-controller.tsx`. When `handleConversationIdChange(newId)` is called with a non-null id, store it locally **and** call `setConversation`. `routeResolution` reads from the local state when the URL hasn't caught up yet, so it goes `null → ready` directly and never visits `"resolving"`. Once the URL contains the same id, the local state clears.

This is the smallest change that keeps `ChatActiveThread` mounted continuously across the new-conversation transition. The existing `createdConversationRef` handshake then works as designed and preserves the optimistic + pending-assistant state until the streamed text arrives.

### Edit — `apps/mirror/app/[username]/_providers/chat-route-controller.tsx`

Add one piece of local state, an effect that clears it once the URL catches up, and route both `routeResolution` and the auto-select effect through `effectiveConversationId`.

```tsx
// New local state (next to newConversationIntent)
const [pendingNewConversationId, setPendingNewConversationId] =
  useState<Id<"conversations"> | null>(null);

const handleConversationIdChange = useCallback(
  (id: Id<"conversations"> | null) => {
    if (!id) {
      setNewConversationIntent(true);
      setPendingNewConversationId(null);
      openChat();
    } else {
      setNewConversationIntent(false);
      // Bridge the gap: routeResolution can resolve to "ready" immediately,
      // before router.replace flushes the searchParams. Without this, the
      // Convex `conversations` reactive query updates first and routeResolution
      // briefly flips to "resolving", unmounting ChatActiveThread and wiping
      // the optimistic + pending-assistant state inside useChatOptimistic.
      setPendingNewConversationId(id);
      setConversation(id);
    }
  },
  [openChat, setConversation],
);

// Clear the bridge once the URL actually contains the id, OR if the user
// navigates somewhere else (URL conversation diverges or chat is closed).
useEffect(() => {
  if (!pendingNewConversationId) return;
  if (conversationId === pendingNewConversationId) {
    setPendingNewConversationId(null);
  } else if (!isChatOpen) {
    setPendingNewConversationId(null);
  }
}, [pendingNewConversationId, conversationId, isChatOpen]);

const effectiveConversationId = conversationId ?? pendingNewConversationId;

// auto-select effect (line 82-99) reads effectiveConversationId
useEffect(() => {
  if (!isChatOpen) return;
  if (effectiveConversationId) return;
  if (conversationInvalid) return;
  if (conversationsLoading) return;
  if (newConversationIntent) return;
  if (conversations.length > 0) {
    setConversation(conversations[0]._id);
  }
}, [
  isChatOpen,
  effectiveConversationId,
  conversationInvalid,
  conversationsLoading,
  newConversationIntent,
  conversations,
  setConversation,
]);

const routeResolution = useMemo((): ChatRouteResolution => {
  if (conversationInvalid) return { status: "invalid" };
  if (effectiveConversationId)
    return { status: "ready", conversationId: effectiveConversationId };
  if (newConversationIntent) return { status: "new_conversation" };
  if (conversationsLoading || conversations.length > 0)
    return { status: "resolving" };
  return { status: "empty" };
}, [
  effectiveConversationId,
  conversationInvalid,
  newConversationIntent,
  conversationsLoading,
  conversations.length,
]);
```

`useState`, `useEffect`, and `Id` are already imported in this file. No new imports.

### Why this is sufficient (and why nothing else needs to change)

- The `createdConversationRef` handshake in `use-chat-optimistic.ts:176-188` already preserves optimistic state when `conversationId` flips from `null → newId`. The bug is not in that handshake; it is that the handshake was being short-circuited by `ChatActiveThread` unmounting. Once `routeResolution` skips `"resolving"` on the new-conversation transition, the handshake works as designed.
- `useChatMessages` will start subscribing to `getConversation({ conversationId: pendingNewConversationId })` one render earlier than before. That is fine: the conversation already exists server-side at this point (the mutation that created it returned successfully before `markCreatedConversation`). The Convex query will resolve quickly, and the `useUIMessages` skip-until-conversation-loads gate (`use-chat-messages.ts:33-39`) keeps message-list state consistent.
- Rollback path: if `sendMessageMutation` throws, `onConversationCreated` is never called (use-chat-send.ts:107-110 is gated on `!conversationId && result.conversationId`). `pendingNewConversationId` stays `null` and `rollbackOptimistic` runs as before.
- Manual conversation switching (clicking a row in `ChatConversationListSheet`) already worked because `routeResolution.status` was already `"ready"` (`conversationId` was non-null), so the `"resolving"` branch was unreachable. Wiring the path through `effectiveConversationId` is a no-op in that case.
- The `isChatOpen` clear branch in the new effect handles the corner case where the user closes the chat (`closeChat()` removes both `chat` and `conversation` from the URL) before the bridge resolved — without it, the bridge could survive past panel close.

### Out of scope for this fix

- No change to `useChatOptimistic`. Its `createdConversationRef` handshake is correct and load-bearing — leave it.
- No change to `ChatThread`. The `"resolving"` branch is correct for the user-just-opened-the-panel case (multiple existing conversations, none auto-selected yet). We are only ensuring it is not visited during new-conversation creation.
- No change to `useChatMessages` / `useChatSend` / `chat-context.tsx`. They already accept a non-null `conversationId` and behave correctly.
- No change to `agent-parity.md`-governed tools or `inputSchema`s. This bug is pure UI-state plumbing.
- No new feature flag or config. This is a regression fix.

---

## Hard verification

### E2E — Playwright CLI (per `.claude/rules/verification.md` § E2E Tests)

The existing spec at `apps/mirror/e2e/chat-assistant-placeholder.spec.ts` already encodes the invariant. It uses a page-side `MutationObserver` to flag whether `[data-slot="chat-message-loading-state"]` was ever attached to the DOM during the first send, and asserts the flag is `false`. That is the exact invariant this fix restores.

Pass criteria — both lines must be reliably green:

- `apps/mirror/e2e/chat-assistant-placeholder.spec.ts:210`

  ```ts
  expect(firstSendTracking.chatLoadingStateSeen).toBe(false);
  ```

- `apps/mirror/e2e/chat-assistant-placeholder.spec.ts:230`

  ```ts
  expect(secondSendTracking.chatLoadingStateSeen).toBe(false);
  ```

The same test also asserts:

- `pendingAssistantSeen` becomes true (line 203) — the optimistic assistant placeholder mounts during send.
- `pendingAssistantDroppedBeforeText` is `false` (line 211) — the placeholder is not unmounted before real assistant text arrives. This is **directly downstream of this fix** (the unmount/remount currently drops it).
- `blankAssistantSeen` is `false` (line 212) — no empty assistant bubble appears mid-flight.

Run command:

```bash
pnpm --filter=@feel-good/mirror test:e2e chat-assistant-placeholder.spec.ts
```

Pass criteria for the plan: this command exits 0 with both `test.describe("Chat assistant placeholder")` cases green. If only the placeholder-related assertion was historically catching the bug intermittently, after the fix it must pass on **3 consecutive runs** to confirm the fix is not timing-dependent.

### Augmentation — explicit unmount/remount guard (additive, same file)

To make the existing spec a sharper guard against future regressions of *exactly* this bug, append a third `data-slot` instance counter inside `installChatStateTracking` so the test would also fail if `ChatActiveThread`'s subtree unmounts mid-send (the ArcSphere-without-data-slot intermediate state at t=8740 in the repro). Add a `data-slot="chat-thread-resolving"` to the `<div className="flex-1 flex items-center justify-center pb-20">` in `chat-thread.tsx:29` so the resolving branch is uniquely identifiable from the DOM, then extend the spec:

```ts
// In installChatStateTracking, near the loading-state selector:
const resolvingStateSelector = '[data-slot="chat-thread-resolving"]';

// In markFlags:
if (document.querySelector(resolvingStateSelector)) {
  trackedWindow.__resolvingStateSeen = true;
}

// In test assertion block (after line 212 for first send):
expect(firstSendTracking.resolvingStateSeen).toBe(false);
```

This pins the invariant `"the chat panel must not visit the 'resolving' branch during new-conversation creation"` directly at the DOM level, independent of the `LoadingFirstPage` symptom which is just one of its downstream effects.

Apply the same `data-slot` to the `ChatThread` resolving early return; the existing CSS class string stays unchanged. The augmentation is additive and changes neither user-visible behavior nor any existing test passing today.

### Build + lint (Tier 4 per `.claude/rules/verification.md`)

```bash
pnpm build --filter=@feel-good/mirror
pnpm lint --filter=@feel-good/mirror
```

Both must exit 0 before running E2E.

### Manual visual confirmation (Chrome MCP — observation, not assertion)

1. Open `/@<some-user>?chat=1` signed in (or anonymous, the bug is profile-agnostic). Confirm `ChatMessageEmptyState` is visible.
2. Type a message and press Enter.
3. Observe continuously: the user bubble appears, the assistant placeholder ("book flip" / pending) appears next to it, **and the thread never collapses to a full-height ArcSphere between the placeholder and the streamed text**. The placeholder is replaced in-place by the streaming text.
4. Repeat with Chrome DevTools network throttling set to "Slow 4G" to widen the URL-update / reactive-query window. Bug must not reappear.
5. Send a second message. Confirm no regression on the already-correct path.

---

## Constraints & non-goals

**In scope:**

- Single-file edit to `apps/mirror/app/[username]/_providers/chat-route-controller.tsx`: add `pendingNewConversationId` local state, the URL-catchup effect, and route `routeResolution` + the auto-select effect through `effectiveConversationId`.
- One-line addition of `data-slot="chat-thread-resolving"` to the resolving early return in `apps/mirror/features/chat/components/chat-thread.tsx:29`, and the matching extension to `installChatStateTracking` in `chat-assistant-placeholder.spec.ts` to lock the invariant.
- Verification: existing `chat-assistant-placeholder.spec.ts` passes `chatLoadingStateSeen === false` and `pendingAssistantDroppedBeforeText === false` reliably.

**Explicitly out of scope:**

- No edits to `useChatOptimistic`, `useChatMessages`, `useChatSend`, `chat-context.tsx`, `chat-thread.tsx` beyond the one `data-slot` attribute, or any chat component file.
- No edits to Convex `chat/mutations.ts`, `chat/queries.ts`, `chat/actions.ts`, or any agent-tool wiring. The bug is purely client-side route-state plumbing.
- No new context provider, no Zustand store (forbidden by `.claude/rules/state-management.md`), no React Query, no `useTransition`, no `setTimeout` (forbidden by `.claude/rules/react-components.md`).
- No change to URL shape or to `useChatSearchParams`. The chat-aware-href contract for content links stays exactly the same.
- No regression of agent-driven navigation (`useAgentIntentWatcher` + `useCloneActions`) — that path doesn't go through `handleConversationIdChange` for conversation creation; it dispatches navigation to other content kinds. `.claude/rules/agent-parity.md` invariants remain intact.
- No backwards-compat shim for the previous `routeResolution` shape — `effectiveConversationId` is a private compute step inside the provider; the public `ChatRouteResolution` type is unchanged.

**Risks I'm accepting:**

- `useChatMessages` starts subscribing one render earlier (when only `pendingNewConversationId` is set, before the URL flushes). The conversation exists server-side by then (the mutation that created it has returned), so `getConversation` will resolve. There is no observable difference from the user's perspective.
- If `router.replace` ever fails silently (it does not, in Next.js App Router), `pendingNewConversationId` would persist until `closeChat()` cleared it via the `!isChatOpen` branch in the new effect. That is a benign degraded mode; the panel still works.
- The `data-slot="chat-thread-resolving"` attribute is a harmless test hook, identical in spirit to the existing `chat-message-loading-state` and `chat-message-empty-state` slots already present on the same component.