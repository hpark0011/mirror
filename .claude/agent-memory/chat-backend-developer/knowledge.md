# chat-backend-developer — Knowledge

*Last updated: 2026-04-14*

## Architecture

Files in `packages/convex/convex/chat/`:

- `schema.ts` — `conversations` table only. Actual message bodies live inside the `@convex-dev/agent` component, keyed by `threadId`.
- `agent.ts` (`"use node"`) — `cloneAgent = new Agent(components.agent, { name: "clone", languageModel, instructions: "" })`. Provider chosen by `LLM_PROVIDER` env (`anthropic` | `openai` | `google`), model by `LLM_MODEL`. Defaults: claude-sonnet-4-20250514 / gpt-4o-mini / gemini-2.0-flash. `instructions` is empty — the system prompt is injected per call via `streamText({ system })`.
- `mutations.ts` — `sendMessage` (public), `retryMessage` (public), `clearStreamingLock` (internal).
- `actions.ts` (`"use node"`) — `streamResponse` internal action: loads context, runs RAG, calls `thread.streamText`, clears lock in `finally`.
- `queries.ts` — `getConversation`, `getConversations`, `listThreadMessages` (wraps `listUIMessages` + `syncStreams`), `internalGetConversation`.
- `helpers.ts` — `composeSystemPrompt`, `loadStreamingContext` (internalQuery), `getLastUserMessage` (internalQuery, paginates full thread).
- `rateLimits.ts` — `chatRateLimiter` via `@convex-dev/rate-limiter`.
- `tonePresets.ts` — single source of truth for tone literals + validator + `TONE_PRESETS` map.

## Data Flow & Contracts

### `conversations` row

```
profileOwnerId: Id<"users">
viewerId?: Id<"users">           // undefined => anonymous conversation
threadId: string                  // handle into @convex-dev/agent component
status: "active" | "archived"
title: string                     // first 100 chars of first message
streamingInProgress?: boolean     // load-bearing lock
streamingStartedAt?: number       // lock fencing token
```

Indexes: `by_profileOwnerId_and_viewerId`, `by_viewerId`, `by_threadId`, `by_streamingInProgress_and_streamingStartedAt`.

### sendMessage pipeline (mutations.ts:10)

1. Validate content (non-empty, ≤ 4000 chars).
2. `authComponent.safeGetAuthUser` → optional `appUser` via `users.by_authId`.
3. Load `profileOwner`; enforce `chatAuthRequired` gate.
4. If `conversationId` given: verify ownership + viewer match, apply `sendMessage` rate limit keyed by user or conversation, reject if `streamingInProgress`.
5. Else: apply `createConversation` rate limit keyed by user or profileOwner.
6. If new conversation: `createThread(ctx, components.agent, { userId: appUser?._id })` then insert row.
7. `saveMessage(ctx, components.agent, { threadId, prompt, userId })` → persists user turn, returns `messageId`.
8. Patch `streamingInProgress: true, streamingStartedAt: Date.now()` (the lock).
9. `ctx.scheduler.runAfter(0, internal.chat.actions.streamResponse, { conversationId, profileOwnerId, promptMessageId, lockStartedAt, userMessage })`.

### retryMessage (mutations.ts:139)

Access-gate → rate limit `retryMessage` → reject if `streamingInProgress` → set lock → schedule `streamResponse` with `promptMessageId: ""` and NO `userMessage`. Retry semantics: empty `promptMessageId` means "respond to latest user message"; `streamResponse` branches on `promptMessageId ? {…with promptMessageId} : {…without}`.

### streamResponse (actions.ts:14)

1. `loadStreamingContext` → `{ threadId, systemPrompt }`.
2. RAG: `ragQuery = userMessage ?? getLastUserMessage(threadId)`. Then `embed` with Google `EMBEDDING_MODEL` / `EMBEDDING_DIMENSIONS` from `../embeddings/config`. Then `ctx.vectorSearch("contentEmbeddings", "by_embedding", { vector, limit: 5, filter: q.eq("userId", profileOwnerId) })`. Filter `_score >= 0.3`. Fetch chunks via `internal.embeddings.queries.fetchChunksByIds`. Append `\n\n## Relevant Content from Your Writing\n\n${chunks...}` to system prompt.
3. **Any RAG error is caught, `console.error`-ed, falls through with empty `ragContext`.** Never throws into `streamText`.
4. `cloneAgent.continueThread(ctx, { threadId })` → `thread.streamText(streamArgs, { saveStreamDeltas: { throttleMs: 100 } })`.
5. `finally` → `clearStreamingLock({ conversationId, expectedStartedAt: lockStartedAt })` — compares `streamingStartedAt === expectedStartedAt` before patching false. This fencing token prevents a stale finally from clearing a newer lock.

### composeSystemPrompt (helpers.ts:14) — fixed section order

Sections joined with `\n\n`:

1. `SAFETY_PREFIX(name)` — identity + never-list (human claim, private info, commitments, medical/legal/financial advice). Always present.
2. Tone clause — only if `tonePreset in TONE_PRESETS`.
3. `Bio: ${bio}` — only if truthy.
4. `personaPrompt || DEFAULT_PERSONA` — always present.
5. `Avoid discussing: ${topicsToAvoid}` — only if truthy.

RAG context is appended outside this function, in `actions.ts:82`. Order changes MUST update `chat/__tests__/helpers.test.ts` alongside.

### Tone presets (tonePresets.ts)

`TONE_PRESET_VALUES = ["professional","friendly","witty","empathetic","direct","curious"]`. Each has `{label, clause}`. `tonePresetValidator` is a `v.union` of literals — reused by user/profile schema elsewhere.

### Rate limits (rateLimits.ts)

Fixed window, all per-minute: `sendMessage` 10, `createConversation` 3, `retryMessage` 5. Key: authed `appUser._id` if present, else fall back (`conversationId` / `profileOwnerId`). All enforced inside mutations with `throws: true`. Do NOT inline throttles elsewhere.

### Access control (queries.ts)

Rules reused across `getConversation`, `getConversations`, `listThreadMessages`:

- Owner (appUser._id === profileOwnerId): sees all conversations on their profile.
- Authed viewer: sees only their own (`viewerId === appUser._id`).
- Anonymous (no appUser): sees only `viewerId === undefined` rows (requires holding the id).

`listThreadMessages` returns `v.any()` because of the `useUIMessages` streaming union type; consumer (`apps/mirror/features/chat/hooks/use-chat.ts`) uses an `as any` to reconcile.

## Gotchas & Edge Cases

- **Streaming lock is load-bearing.** The `finally` in `streamResponse` must always run. `clearStreamingLock` uses `expectedStartedAt` as a fencing token — do not remove that check or a late finally will stomp a newer stream.
- **RAG is best-effort.** Embedding or vector-search failures MUST fall through with empty `ragContext`. Never let them throw into `streamText`.
- **Retry has no user-message argument.** `retryMessage` intentionally omits `userMessage`; `streamResponse` falls back to `getLastUserMessage`, which paginates the full thread (unbounded for very long threads — potential amplification).
- **Retry may duplicate assistant turns.** `retryMessage` does NOT delete a prior failed assistant message before re-running. Depending on `@convex-dev/agent` semantics, a retry can append a new assistant message rather than replacing the failed one. Suspected cause of the elaborate reconciliation logic in `use-chat.ts`.
- **No stuck-lock reaper.** The `by_streamingInProgress_and_streamingStartedAt` index exists but nothing in `chat/` uses it. A crash between lock-set and action `finally` leaves a conversation permanently blocked.
- **`getConversation` public shape omits `streamingStartedAt`** (present only on `internalGetConversation`). Public clients cannot distinguish stuck from active.
- **`agent.ts` instructions is `""`.** System prompt is injected per call. Any future `generateText` without an explicit `system:` will run un-prompted.
- **Convex rules:** new function syntax, validators on args+returns, `withIndex` not `filter`, `"use node"` on `agent.ts` and `actions.ts` (both use Node modules), run `pnpm exec convex codegen` (not `npx`) after signature/schema changes.

## References

| Type | Resource | Why it matters |
|---|---|---|
| Internal | `packages/convex/convex/chat/__tests__/helpers.test.ts` | Locks in `composeSystemPrompt` section order — update with any order change |
| Internal | `packages/convex/convex/chat/__tests__/tonePresets.test.ts` | Contract test for tone literals/clauses |
| Internal | `packages/convex/convex/embeddings/config.ts` | Source of `EMBEDDING_MODEL` / `EMBEDDING_DIMENSIONS` used by RAG |
| Internal | `packages/convex/convex/embeddings/queries.ts` | `fetchChunksByIds` — RAG read dependency |
| Internal | `apps/mirror/features/chat/hooks/use-chat.ts` | Consumer — optimistic reconciliation logic; symptom surface for message-ordering bugs |
| Internal | `apps/mirror/features/chat/hooks/use-conversations.ts` | Consumer — conversation list |
| External | `@convex-dev/agent` | `createThread`, `saveMessage`, `listUIMessages`, `syncStreams`, `Agent`, `listMessages` |
| External | `@convex-dev/rate-limiter` | `RateLimiter`, `MINUTE` |
