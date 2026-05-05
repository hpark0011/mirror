---
date: 2026-05-04
type: feature
status: draft
related_research: docs/research/2026-05-04-greyboard-agent-ui-parity.md
related_tickets:
  - FG_124  # adjacent context-parity gap (composeSystemPrompt content-kind noun test)
---

# Plan: Bring Greyboard's agent-UI parity pattern into Mirror

## Context

Today, Mirror's clone agent is **read-only**. It composes a system prompt at request time, retrieves user content via `vectorSearch` on `contentEmbeddings` (filtered by `userId`), and emits text. `cloneAgent` at `packages/convex/convex/chat/agent.ts:33-37` is constructed with no `tools` map, so it cannot navigate the visitor, change the right panel, or take any UI action. If a visitor asks "show me your latest article," the best the clone can do is quote from a chunk and emit a `[Read more](/<slug>)` link — the visitor still has to click.

Greyboard, the sibling Electron app at `greyboard/`, ships the agent-controls-the-UI piece. Its principle (`agents.md:35`):

> Any action a user can take through the UI, the agent must be able to take through an MCP tool. A UI feature without an agent tool is a parity bug, not a feature.

The shape that makes parity cheap is **two routes, one controller** (`docs/architecture.md:101-104`): both the user's UI clicks and the agent's tool calls dispatch into the same `UiController` interface. There is no agent-only path.

We want the same shape in Mirror, adapted to the stack (Convex `Agent` + Next.js parallel routes instead of Electron IPC + MCP). Concretely: when a visitor asks the clone "show me your latest article," the right panel should change. Every verb the user can take, the agent should be able to call.

This plan delivers a **thin end-to-end demo** of that pattern with one verb (`navigateToContent`) and the architectural pieces needed to add more verbs cheaply. Future work (clone-settings tools, panel-toggle tools, write tools) composes on the same seams.

## Final design

### The two routes, one dispatcher shape

```text
User path:   <Link>/click handler → useCloneActions().navigateToContent(...) → router.push(href)
Agent path:  cloneAgent tool call → tool result in UIMessage.parts → useAgentIntentWatcher → useCloneActions().navigateToContent(...)
                                                                                         ↓
                                                                                         router.push(href)
```

One `useCloneActions` hook is the single dispatcher — a minimal interface of verbs (`navigateToContent`, plus future `openPanel`, `setTone`, etc.) that the user UI and the agent intent watcher both call. There is no separate "agent navigation" path that bypasses it.

### Critical nuance: tools cannot navigate from the server

`@convex-dev/agent` tools registered via `createTool` execute inside the Convex action (Node runtime), not in the renderer. They cannot call `router.push`. So the tool's `handler` does the *server-resolvable* part — looking up the latest article's slug, validating ownership — and returns a **structured tool result** that the client renders.

The client side reads incoming `UIMessage.parts` (which include `toolCall` and `toolResult` parts per the AI SDK shape, written to the agent component's stream tables and streamed to the client via `listUIMessages` + `syncStreams`). When a tool result with a known `toolName` lands, the intent watcher invokes the dispatcher.

This keeps the agent honest: it cannot fire-and-forget invisible navigation. Every action passes through the same client-side dispatcher the user's UI uses, so we can render confirmations, audit, or short-circuit if needed.

### Cross-user isolation invariant — extended from RAG to actions

The existing rule from `.claude/rules/embeddings.md` says: every `userId` written into `contentEmbeddings` must come from `getAppUser(ctx, ctx.user._id)`, never from a client arg. Tool design extends this: **every tool's data resolution scopes to `profileOwnerId` server-side, never from a tool argument**.

`cloneAgent.streamText` runs inside `streamResponse` (`chat/actions.ts:76-172`), which already has `profileOwnerId` in scope. The tool definition closes over it (or reads it from `ToolCtx`), so the LLM cannot pass a different user's id in tool args. Tool arg validators MUST NOT include `userId`.

### Tool surface — Phase 1 (thin demo)

Two tools, both pure-data:

1. **`getLatestPublished({ kind: "articles" | "posts" })`** — server query. Returns `{ slug, title, publishedAt } | null` for `profileOwnerId`. The agent calls this when it needs to resolve "latest" before navigating.
2. **`navigateToContent({ kind: "articles" | "posts", slug: string })`** — server *resolver*, not navigator. `handler`:
   - Validates the doc exists, is owned by `profileOwnerId`, and is published.
   - Returns `{ kind, slug, title, href }` as the tool result.
   - Does NOT actually navigate — only the client can do that.

Both follow the data-primitive principle from `.claude/agents/code-review/agent-native.md` § 4 — inputs are data, not decisions. The agent composes them: ask `getLatestPublished("articles")` → get slug → call `navigateToContent({ kind: "articles", slug })`.

Bio, `clone-settings`, panel-toggle, and write tools are deferred to Phase 2+ — same pattern, more verbs.

### File-by-file changes

#### Convex side (`packages/convex/convex/chat/`)

**New: `chat/tools.ts`** — defines the tool surface using `createTool` from `@convex-dev/agent`. Closes over `profileOwnerId` per-request via a factory:

```ts
// pseudo-shape
export function buildCloneTools(profileOwnerId: Id<"users">) {
  return {
    getLatestPublished: createTool({
      description: "Get the most recent published article or post for this profile.",
      args: z.object({ kind: z.enum(["articles", "posts"]) }),
      handler: async (ctx, { kind }) => {
        const row = await ctx.runQuery(internal.chat.tools.queryLatestPublished, {
          userId: profileOwnerId, kind,
        });
        return row;
      },
    }),
    navigateToContent: createTool({
      description: "Open an article or post in the visitor's right panel.",
      args: z.object({
        kind: z.enum(["articles", "posts"]),
        slug: z.string(),
      }),
      handler: async (ctx, { kind, slug }) => {
        const row = await ctx.runQuery(internal.chat.tools.resolveBySlug, {
          userId: profileOwnerId, kind, slug,
        });
        if (!row) throw new Error("Not found or not published");
        return { kind, slug: row.slug, title: row.title, href: `/@${row.username}/${kind}/${row.slug}` };
      },
    }),
  };
}
```

**Modified: `chat/actions.ts:streamResponse`** — pass `tools: buildCloneTools(profileOwnerId)` into the `thread.streamText` call. The `Agent` constructor's `instructions` stays empty; tools attach per-request because they need `profileOwnerId` in closure.

**New internal queries: `chat/toolQueries.ts`** — `queryLatestPublished` and `resolveBySlug`. Both take `userId: Id<"users">` (server-derived in caller) and `kind`. Articles/posts queries already filter by `status === "published"` in existing helpers.

**Modified: `chat/agent.ts`** — no change to the singleton; tools are per-call.

**Modified: `chat/helpers.ts:composeSystemPrompt`** — extend with a tools-vocabulary section so the agent knows the verbs exist (the same noun-test fix that ticket FG_124 captures for content kinds). Phrasing example: "You can navigate the visitor's view by calling `navigateToContent` after looking up the slug with `getLatestPublished`."

#### Client side (`apps/mirror/`)

**New: `app/[username]/_providers/clone-actions-context.tsx`** — the dispatcher. Exposes `useCloneActions()`:

```ts
type CloneActions = {
  navigateToContent: (args: { kind: "articles" | "posts"; slug: string }) => void;
  // Future: openPanel, setTone, setEditMode, etc.
};
```

Implementation reads `useRouter`, `useChatSearchParams` (for `buildChatAwareHref`), and `useProfileRouteData` for the username. `navigateToContent` does `router.push(buildChatAwareHref(getContentHref(username, kind, slug)))` — exactly what `ArticleListItem` does today, just centralized.

**New: `features/chat/hooks/use-agent-intent-watcher.ts`** — subscribes to `UIMessage[]` (already returned by `useChatMessages`), detects tool-result parts with known `toolName` values from the *latest* assistant message, and calls the matching `useCloneActions` verb. Idempotency: track the last-handled `(messageId, partIndex)` in a ref so re-renders don't re-fire navigation.

**Modified: `features/chat/components/chat-thread.tsx`** — mount `useAgentIntentWatcher()` once. No change to `chat-message-item.tsx` rendering (text only); tool-result parts drive navigation, not visible UI. (We can later render an inline confirmation if we want.)

**Refactor: `features/articles/components/article-list-item.tsx`** — replace the manual `buildChatAwareHref(getContentHref(...))` + `<Link>` with `useCloneActions().navigateToContent(...)` on click. Same for posts list. *This is the proof that the user route uses the same dispatcher* — without this refactor, parity is theoretical. (Keep `<Link>` for SEO/right-click semantics; the click handler calls the dispatcher first (`useCloneActions().navigateToContent(...)`), then unconditionally `event.preventDefault()` to suppress the `<Link>`'s default navigation. The dispatcher synchronously initiates `router.push`, so the call order matters but the outcome doesn't gate the prevent-default.)

#### Project rules

**New: `.claude/rules/agent-parity.md`** — the checklist rule, paths-scoped to:
```yaml
paths:
  - "packages/convex/convex/chat/**"
  - "apps/mirror/features/chat/**"
  - "apps/mirror/app/[username]/_providers/**"
```

Mirrors Greyboard's `.claude/rules/agent-parity.md` adapted to Mirror's stack: when a new user-facing action is added, the same commit must (a) add or extend a verb on `useCloneActions`, (b) register the matching tool on `cloneAgent`, (c) update `composeSystemPrompt`'s tools-vocabulary section, (d) confirm tool data-resolution pins to `profileOwnerId`.

**Modified: `AGENTS.md`** — add Agent Parity to § Core Principles as a top-level bullet, referencing the new rule. (Today parity lives only in `.claude/agents/code-review/agent-native.md`.)

**Modified: `.claude/agents/code-review/agent-native.md`** — extend lens § 4 (Agent tools) with concrete check-list items now that tools exist: data-primitive shape, no `userId` in args, system-prompt mention.

### Files to be modified — index

| File | Change |
|---|---|
| `packages/convex/convex/chat/tools.ts` | New — `buildCloneTools(profileOwnerId)` factory |
| `packages/convex/convex/chat/toolQueries.ts` | New — internal queries (`queryLatestPublished`, `resolveBySlug`) |
| `packages/convex/convex/chat/actions.ts` | Pass `tools` per-call into `thread.streamText` |
| `packages/convex/convex/chat/helpers.ts` | Add tools-vocabulary section to `composeSystemPrompt` |
| `apps/mirror/app/[username]/_providers/clone-actions-context.tsx` | New — `useCloneActions` dispatcher |
| `apps/mirror/app/[username]/layout.tsx` | Wrap children in `<CloneActionsProvider>` |
| `apps/mirror/features/chat/hooks/use-agent-intent-watcher.ts` | New — tool-result watcher → dispatcher |
| `apps/mirror/features/chat/components/chat-thread.tsx` | Mount the watcher |
| `apps/mirror/features/articles/components/article-list-item.tsx` | Click handler routes through dispatcher |
| `apps/mirror/features/posts/components/post-list-item.tsx` (likely path) | Same refactor |
| `.claude/rules/agent-parity.md` | New — paths-scoped checklist |
| `AGENTS.md` | Add Agent Parity to Core Principles |
| `.claude/agents/code-review/agent-native.md` | Extend § 4 with tool-checklist items |

### Reused functions/utilities

- `buildChatAwareHref` (`apps/mirror/hooks/use-chat-search-params.ts:39-49`) — preserves `?chat=1&conversation=...` across navigation. The dispatcher uses this; do not duplicate the logic.
- `getContentHref` (`apps/mirror/features/content/types.ts:26-33`) — canonical href builder.
- `getAppUser` (`packages/convex/convex/lib/auth.ts`) — server-side userId derivation. Tool queries should NOT use this directly — `profileOwnerId` is already in `streamResponse`'s scope, and the tool factory closes over it.
- `embeddingSourceTableValidator` (`packages/convex/convex/embeddings/schema.ts:21-25`) — when Phase 2 adds tools for bio entries, key the verbs off this same union to keep type-checked parity with the RAG side.
- `composeSystemPrompt` (`packages/convex/convex/chat/helpers.ts:86-131`) — already truncatable; the new tools-vocabulary section goes into the truncatable region.

### Out of scope (explicit)

- **Write tools.** No `agent_drafts_a_post`, no `agent_edits_bio` in this phase. When added, the gate model needs designing (chat user must equal profile owner, etc.).
- **Permission gate.** Greyboard's `ToolExecutionGate` is deferred. Read + nav tools auto-execute since they only mutate URL state on the visitor's session.
- **Tools for clone-settings, panel toggle, tone preset, video call open.** Add in Phase 2 — same pattern.
- **Refactoring all `router.push`/`<Link>` usage** through the dispatcher. Phase 1 only refactors `article-list-item` and `post-list-item` to prove the pattern. Other call sites can migrate incrementally.
- **Extending `useChatMessages` / `chat-message-item` to render tool-result parts visually.** Phase 1 keeps the chat looking identical; navigation just happens. Phase 2 can render "Opened: Article Title" inline if desired.
- **The bio-noun-test ticket FG_124.** Adjacent but separate; do not bundle.

## Verification

End-to-end test path (Phase 1 done = this works):

1. **Build + lint** — Tier 2 from `.claude/rules/verification.md`:
   ```bash
   pnpm build --filter=@feel-good/mirror
   pnpm lint --filter=@feel-good/mirror
   pnpm --filter=@feel-good/convex test
   ```
   New `chat/__tests__/tools.test.ts` should cover: tool args validator rejects `userId`, `getLatestPublished` returns null for unpublished, `navigateToContent` rejects cross-user slugs (the security-critical assertion).

2. **Cross-user isolation regression test** — extend `chat/__tests__/rag-cross-user.test.ts` with a tool-call equivalent: User A's clone, asked about User B's article slug, must reject (the tool's `resolveBySlug` filters by `profileOwnerId`).

3. **Manual end-to-end via Chrome MCP** (Tier 4):
   - Run `pnpm dev --filter=@feel-good/mirror` (port 3001).
   - Sign in as a user with at least one published article.
   - Open the user's profile chat panel.
   - Send: "show me your latest article."
   - Expect: chat assistant message renders normally; right panel transitions to the latest article's detail view; URL updates to `/@<username>/articles/<slug>?chat=1&conversation=...`; chat panel stays open.
   - Negative cross-user tests:
     - **Scenario A — explicit slug from another user.** User types or pastes a path like `/@bob/articles/bobs-slug-123` while signed in as Alice. The agent's `navigateToContent` tool calls `resolveBySlug({ userId: profileOwnerId, slug })` — `profileOwnerId` is Alice's id, so the lookup returns null and the tool replies "Not found or not published." No router.push fires.
     - **Scenario B — RAG cannot leak Bob's slug.** The vector index filter pins `userId` to Alice's id (see `chat/actions.ts` `vectorSearch`), so Bob's content cannot enter Alice's chat context. Confirms the agent has no path to "discover" a foreign slug through retrieval.

4. **E2E spec** (Playwright CLI, per `.claude/rules/verification.md` § E2E Tests):
   - New `apps/mirror/e2e/chat-agent-navigates.authenticated.spec.ts`:
     - Visits a profile page with chat open.
     - Sends "show me your latest article."
     - Asserts `page.url()` contains `/articles/`.
     - Asserts the content panel renders an article-detail component.
   - Run: `pnpm --filter=@feel-good/mirror test:e2e -- chat-agent-navigates`.

5. **Agent-native code review** (post-implementation): run the `code-review-agent-native` reviewer against the diff. It should pass on (a) RAG ingestion (unchanged), (b) system-prompt mention of tools added, (c) tool-arg validators have no `userId`, (d) data resolution scoped to `profileOwnerId`. Any failure here is a parity bug, not a stylistic one.
