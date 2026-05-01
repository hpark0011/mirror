# chat-backend-developer — Knowledge

*Last updated: 2026-04-30*

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

### sendMessage pipeline (mutations.ts, Wave 1)

Order is load-bearing — both rate-limit checks MUST run before any `ctx.db.patch({ streamingInProgress: true })` (NFR-03) so a daily-cap rejection never leaves a stale lock.

1. Validate content (non-empty, ≤ **3000 chars**, Wave 1).
2. `authComponent.safeGetAuthUser` → optional `appUser` via `users.by_authId`.
3. Load `profileOwner`; enforce `chatAuthRequired` gate.
4. If `conversationId` given: verify ownership + viewer match; apply `sendMessage` per-minute limit. Else: apply `createConversation` per-minute limit.
5. **Daily ceiling** (Wave 1): apply `sendMessageDailyAuth` (keyed by `appUser._id`) OR `sendMessageDailyAnon` (keyed by `profileOwnerId`). Same pattern in both branches.
6. Concurrency guard: reject if `streamingInProgress` (existing-conversation branch only).
7. If new conversation: `createThread(ctx, components.agent, { userId: appUser?._id })` then insert row.
8. `saveMessage(ctx, components.agent, { threadId, prompt, userId })` → persists user turn, returns `messageId`.
9. Patch `streamingInProgress: true, streamingStartedAt: Date.now()` (the lock).
10. `ctx.scheduler.runAfter(0, internal.chat.actions.streamResponse, { conversationId, profileOwnerId, promptMessageId, lockStartedAt, userMessage })`.

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

**Per-minute burst** (fixed window, unchanged Wave 1):
- `sendMessage` 10/min — key: `appUser._id` (auth) / `conversationId` (anon existing) / `profileOwnerId` (anon new).
- `createConversation` 3/min — key: `appUser._id` / `profileOwnerId`.
- `retryMessage` 5/min — **Wave 1 re-keying**: now `appUser._id` / `profileOwnerId` (was `conversationId` for anon). Matches `sendMessage` so retries can't bypass daily caps by switching conversations.

**Daily output-spend ceiling** (token bucket, added in Wave 1):
- `sendMessageDailyAnon` — rate 200/day, capacity 50, keyed by `profileOwnerId`.
- `sendMessageDailyAuth` — rate 500/day, capacity 100, keyed by `appUser._id`.

Applied in BOTH branches of `sendMessage` (new + existing conversation) AND in `retryMessage`. The daily bucket runs AFTER the per-minute bucket and BEFORE the streaming-lock patch (NFR-03).

**Rejection contract** (Wave 1): both per-minute and daily rejections are wrapped in `ConvexError({ code: "RATE_LIMIT_MINUTE" | "RATE_LIMIT_DAILY", retryAfterMs: number })`. The `retryAfter` field from `@convex-dev/rate-limiter` is **already in milliseconds** — pass through directly, do NOT convert. Use `throws: false` on `.limit()`, inspect `.ok`, construct the `ConvexError` on rejection. See `enforceLimit` helper in `mutations.ts`.

Do NOT inline throttles elsewhere.

### RAG ingestion (write-side, adjacent — not chat-owned)

Live as of 2026-04-30 with the bio source landed. Owns this surface only
because it shapes what the chat agent's system prompt sees.

- **Sources**: `articles`, `posts`, `bioEntries`. `embeddingSourceTableValidator` (in `embeddings/schema.ts`) is the **single shared validator** — no longer duplicated across six call sites. Adding a new source is one literal here + branches in `getContentForEmbedding` and `generateEmbedding`.
- **Trigger pattern**: owning create/update mutation calls `ctx.scheduler.runAfter(0, internal.embeddings.actions.generateEmbedding, { sourceTable, sourceId })`; owning delete/unpublish calls `internal.embeddings.mutations.deleteBySource`. Canonical: `articles/mutations.ts`, `posts/mutations.ts`, `bio/mutations.ts`.
- **Idempotency**: `generateEmbedding` itself runs `deleteBySource` then `insertChunks`, so re-runs are safe.
- **Discriminated union**: `getContentForEmbedding` returns `{ kind: "doc", title, body, slug, userId, status }` for articles/posts, OR `{ kind: "bio", title, body, userId }` for bioEntries (no slug, no status). `generateEmbedding` discriminates on `content.kind` — the published-status gate runs only on `kind === "doc"`. **Do not fabricate `status: "published"` sentinels for new structured sources** — that's the trap C1 blocked.
- **Slug**: `contentEmbeddings.slug` is `v.optional(v.string())`. Bio rows persist `slug: undefined`. `buildRagContext` skips the `[Read more]` link when slug is empty/undefined. The `fetchChunksByIds` returns validator MUST also have `slug: v.optional(v.string())` — else bio chunks are rejected on retrieval and the catch-block in `streamResponse` silently swallows them, making bio invisible to the agent (this was iter2-Finding1).
- **`userId` provenance** (cross-user isolation): `userId` comes from `getAppUser(ctx, ctx.user._id)` ONLY. Never from a client-supplied arg. The vector-search filter `q.eq("userId", profileOwnerId)` at `chat/actions.ts` is the sole isolation barrier. See `.claude/rules/embeddings.md` for the canonical rule.
- **Bio entries bypass the chunker** (single chunk, `chunkIndex: 0`). They're already short prose serialized via `bio/serializeForEmbedding.ts` — feeding them through `extractPlainText` would crash (string body not TipTap JSON), and `chunkText` would be a no-op anyway.

### Access control (queries.ts)

Rules reused across `getConversation`, `getConversations`, `listThreadMessages`:

- Owner (appUser._id === profileOwnerId): sees all conversations on their profile.
- Authed viewer: sees only their own (`viewerId === appUser._id`).
- Anonymous (no appUser): sees only `viewerId === undefined` rows (requires holding the id).

`listThreadMessages` returns `v.any()` because of the `useUIMessages` streaming union type; consumer (`apps/mirror/features/chat/hooks/use-chat.ts`) uses an `as any` to reconcile.

## Wave 1 Constants (do not silently tune)

- `MAX_MESSAGE_LENGTH = 3000` — `mutations.ts`. Rejected with plain `Error` (not `ConvexError`) before any rate-limit call so oversize messages don't consume daily budget.
- `RAG_CHUNK_MAX_CHARS = 800` / `RAG_CONTEXT_MAX_CHARS = 4000` — `actions.ts`, exported. `buildRagContext()` is the only assembly path; preserves input order, truncates each chunk then caps total.
- `RAG_CONTEXT_HEADER = "\n\n## Relevant Background and Writing\n\n"` — `actions.ts`, exported (renamed 2026-04-30 from "Relevant Content from Your Writing" to cover bio + future structured sources). `buildRagContext` accepts `Array<{ title, chunkText, slug? }>` — the slug-stripping cast at the call site was removed when the bio source landed. Bio chunks have `slug: undefined` and skip the `[Read more](/<slug>)` link; articles/posts emit it.
- `RAG_RESULT_LIMIT = 5`, `RAG_SCORE_THRESHOLD = 0.3` — unchanged from pre-Wave 1.
- `SYSTEM_PROMPT_MAX_CHARS = 6000` — `helpers.ts`. `composeSystemPrompt` proportionally shrinks the bio/persona/topics sections when over budget. Safety prefix + tone clause are never truncated; section order (safety → tone → bio → persona → topics) is preserved.
- `maxOutputTokens: 1024` — passed on BOTH branches of the `streamArgs` ternary in `actions.ts` → `thread.streamText`. Caps Anthropic output per turn.

## Gotchas & Edge Cases

- **Streaming lock is load-bearing.** The `finally` in `streamResponse` must always run. `clearStreamingLock` uses `expectedStartedAt` as a fencing token — do not remove that check or a late finally will stomp a newer stream.
- **RAG is best-effort.** Embedding or vector-search failures MUST fall through with empty `ragContext`. Never let them throw into `streamText`.
- **Retry has no user-message argument.** `retryMessage` intentionally omits `userMessage`; `streamResponse` falls back to `getLastUserMessage`, which paginates the full thread (unbounded for very long threads — potential amplification).
- **Retry may duplicate assistant turns.** `retryMessage` does NOT delete a prior failed assistant message before re-running. Depending on `@convex-dev/agent` semantics, a retry can append a new assistant message rather than replacing the failed one. Suspected cause of the elaborate reconciliation logic in `use-chat.ts`.
- **No stuck-lock reaper.** The `by_streamingInProgress_and_streamingStartedAt` index exists but nothing in `chat/` uses it. A crash between lock-set and action `finally` leaves a conversation permanently blocked.
- **`getConversation` public shape omits `streamingStartedAt`** (present only on `internalGetConversation`). Public clients cannot distinguish stuck from active.
- **`agent.ts` instructions is `""`.** System prompt is injected per call. Any future `generateText` without an explicit `system:` will run un-prompted.
- **Convex rules:** new function syntax, validators on args+returns, `withIndex` not `filter`, `"use node"` on `agent.ts` and `actions.ts` (both use Node modules), run `pnpm exec convex codegen` (not `npx`) after signature/schema changes.
- **`getContentForEmbedding` is now a discriminated union (post-2026-04-30).** Returns `{ kind: "doc", body: <tiptap JSON>, slug, userId, status }` for articles/posts or `{ kind: "bio", body: <pre-serialized prose string>, userId }` for bioEntries. `generateEmbedding` branches on `kind` — `kind === "doc"` runs through `extractPlainText` + `chunkText`; `kind === "bio"` is fed straight to `embedMany` as a single chunk. When adding a new ingestion source, mirror the bio branch (skip extractPlainText + chunker for short structured records) — do NOT widen the doc branch's `body: v.any()` and let TipTap-walking crash on string bodies.

## Convex module-name constraint (learned 2026-04-30)

**Convex bundles `convex/**/*.ts` and rejects file paths with hyphens.** The
exact error is `InvalidConfig: <path> is not a valid path to a Convex
module. Path component <name>.js can only contain alphanumeric characters,
underscores, or periods.`

This means **non-test files inside `convex/` MUST use camelCase or
snake_case file names** — not kebab-case. Test files in `__tests__/`
directories are not bundled, so their names can use hyphens freely.

If you create a new file like `serialize-for-embedding.ts` it will pass
TypeScript and Vitest but fail at `convex codegen --typecheck disable`
(runtime push). Catch this early by running codegen any time a new
non-test file is added under `convex/`.

The renamed pattern in this repo: `convex/bio/serializeForEmbedding.ts`
(NOT `serialize-for-embedding.ts`).

## convex-test harness gotchas (learned Wave 1)

Writing integration tests for `chat/mutations.ts` via `convex-test` has several traps that cost iterations if not known up front:

1. **Vite glob prefix normalization.** From a nested `convex/chat/__tests__/` test file, `import.meta.glob("../../**/*.ts")` returns *mixed* relative prefixes: files inside `chat/` come back as `../actions.ts`, while other dirs come back as `../../articles/...`. `convex-test`'s `findModulesRoot` infers a single prefix from the first `_generated/*` entry and uses it for ALL lookups, so the `../`-prefixed files are unresolvable. **Fix**: normalize every glob key to start with `../../chat/...` (or re-root to `../../chat/__tests__/...` for `./` entries) before passing the modules map into `convexTest(schema, modules)`. See `rateLimits.test.ts` `normalizeConvexGlob` helper.
2. **`ConvexError.data` is a JSON string across the test harness boundary.** `throw new ConvexError({ code, retryAfterMs })` inside a mutation handler surfaces in test code with `err.data` as a **JSON-encoded string**, not the structured object. Assertions on `.data.code` silently yield `undefined`. **Fix**: `JSON.parse(err.data)` in a `getErrorData` helper.
3. **Mocking `@convex-dev/agent`.** `chat/agent.ts` does `new Agent(components.agent, ...)` at module load, so a `vi.mock("@convex-dev/agent", ...)` factory MUST export `Agent` as a **class** (not a function), and stub `createThread`, `saveMessage`, and `listMessages` as async functions. Otherwise module-load fails with `Agent is not a constructor`.
4. **Mocking `../auth/client`.** `mutations.ts` imports `authComponent` from `../auth/client` which in turn pulls in Better Auth. Stub with `vi.mock("../auth/client", () => ({ authComponent: { safeGetAuthUser: async () => null } }))`. Note: the Vite hoisted spec-string must be the **exact import path mutations.ts uses**, not the test-file-relative path.
5. **Clearing the streaming lock between successive sends.** Back-to-back `sendMessage` calls on the same `conversationId` will hit the concurrency guard (`"A response is already being generated"`), which throws a plain `Error` BEFORE the rate limiter runs. For per-minute burst tests, manually `ctx.db.patch(conversationId, { streamingInProgress: false, streamingStartedAt: undefined })` after each call.
6. **Mounting the rate-limiter component.** `t.registerComponent("rateLimiter", schema, glob)` — the schema and module glob must come from the pnpm-resolved path `node_modules/.pnpm/@convex-dev+rate-limiter@.../node_modules/@convex-dev/rate-limiter/src/component/`. The version in the path needs updating when the dep bumps.
7. **Source-level assertions are fair game.** For `actions.ts` (`"use node"`) behavior that's too deep to execute through the harness (e.g. confirming `maxOutputTokens: 1024` is passed to `thread.streamText`), a `readFileSync`-based grep assertion catches regressions without needing to run the action. Use sparingly and only when the runtime path requires a full agent-component mount.

## Test runner

- Vitest config: `packages/convex/vitest.config.ts`. Environment `node`. `server.deps.inline: ["convex-test"]` is set (required under pnpm's isolated layout; leave it even before the first `convex-test` call site exists).
- **Include glob (as of 2026-04-30)**: `convex/chat/**/*.test.ts`, `convex/betaAllowlist/**/*.test.ts`, `convex/waitlistRequests/**/*.test.ts`, `convex/bio/**/*.test.ts`, `convex/embeddings/**/*.test.ts`. Do NOT widen to `convex/**/*.test.ts` — `convex/users/__tests__/{getCurrentProfile,updatePersonaSettings}.test.ts` still import from `bun:test`. Widen per-domain only after migration.
- `convex-test@^0.0.48` is installed but not yet exercised by any test in `chat/__tests__/`. First usage just needs `convexTest(schema, import.meta.glob("./**/*.ts"))`.
- `@feel-good/convex` has **no `build` script**. `pnpm --filter=@feel-good/convex build` is a turbo no-op and is not a real typecheck. The actual typecheck command is `pnpm --filter=@feel-good/convex check-types` (runs `tsc --noEmit -p convex/tsconfig.json`). Use that in verification, not `build`.
- Run tests via `pnpm --filter=@feel-good/convex test` (script: `vitest run`).

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
