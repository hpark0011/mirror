---
paths:
  - "packages/convex/convex/chat/**"
  - "apps/mirror/features/chat/**"
  - "apps/mirror/app/[username]/_providers/**"
---

# Agent Parity

> Auto-loads under `packages/convex/convex/chat/**`,
> `apps/mirror/features/chat/**`, and
> `apps/mirror/app/[username]/_providers/**`.

Every action a user can take through the Mirror UI, the clone agent must
be able to take through a tool. A UI verb without a matching agent tool
is a parity bug, not a feature. The shape that makes parity cheap is
**two routes, one dispatcher** — the same pattern Mirror adopted from a
sibling Electron app's MCP architecture and adapted to this stack
(Convex `Agent` + Next.js parallel routes). The reference implementation
in this repo is
[`apps/mirror/app/[username]/_providers/clone-actions-context.tsx`](../../apps/mirror/app/[username]/_providers/clone-actions-context.tsx).

## Two routes, one dispatcher

The user's UI clicks and the agent's tool-call results funnel through a
single dispatcher. There is no agent-only navigation path.

```
User path:   <Link>/click handler → useCloneActions().<verb>(...) → router.push(...)
Agent path:  cloneAgent tool call → tool-<name> part in UIMessage
                                  → useAgentIntentWatcher
                                  → useCloneActions().<verb>(...)
                                                    ↓
                                                    router.push(...)
```

The dispatcher lives at
[`apps/mirror/app/[username]/_providers/clone-actions-context.tsx`](../../apps/mirror/app/[username]/_providers/clone-actions-context.tsx).
The agent half — the watcher that turns tool-result parts into dispatcher
calls — lives at
[`apps/mirror/features/chat/hooks/use-agent-intent-watcher.ts`](../../apps/mirror/features/chat/hooks/use-agent-intent-watcher.ts).
Mount the watcher next to where chat messages are read; today it lives in
`ChatActiveThread`.

**Do not add a parallel "agent navigates" path.** Tool handlers run on
the server (Convex action / Node runtime) and **cannot** call
`router.push`. The handler resolves the server-resolvable part (look up
slug, validate ownership, build href) and returns a structured result.
The client-side dispatcher does the actual navigation.

## Cross-user isolation invariant — extends from RAG to actions

The RAG rule from `.claude/rules/embeddings.md` requires every `userId`
written into `contentEmbeddings` to come from
`getAppUser(ctx, ctx.user._id)`. The action-side rule extends this:
**every tool's data resolution scopes to `profileOwnerId` server-side
via factory closure, never via tool args.**

The factory in
[`packages/convex/convex/chat/tools.ts`](../../packages/convex/convex/chat/tools.ts)
closes over `profileOwnerId`. The LLM-visible `inputSchema` for every
tool MUST NOT include `userId`, `user_id`, `ownerId`, or any other user
identifier — if it did, the model could pass an arbitrary user id and
the cross-user boundary would collapse.

The unit test in
[`packages/convex/convex/chat/__tests__/tools.test.ts`](../../packages/convex/convex/chat/__tests__/tools.test.ts)
(see the `inputSchema invariants` describe block) pins this. Adding a
new tool? Add the matching `inputSchema invariants` assertion before the
PR lands.

## Adding a new agent verb — four-step checklist

Apply all four steps in the same commit. Skipping any one breaks the
parity loop.

1. **Add or extend the verb on `useCloneActions`** at
   [`apps/mirror/app/[username]/_providers/clone-actions-context.tsx`](../../apps/mirror/app/[username]/_providers/clone-actions-context.tsx).
   The verb is the single dispatcher; both the user-UI click path and the
   agent intent-watcher call it.
2. **Register the matching tool in `buildCloneTools`** at
   [`packages/convex/convex/chat/tools.ts`](../../packages/convex/convex/chat/tools.ts).
   The factory closes over `profileOwnerId`. The `inputSchema` must NOT
   include any user identifier. Keep handlers as data primitives — look
   up X, validate Y, return a structured result. Do NOT encode workflow
   logic or call `router.push`.
3. **Update `TOOLS_VOCABULARY`** in
   [`packages/convex/convex/chat/helpers.ts`](../../packages/convex/convex/chat/helpers.ts)
   so the agent knows the verb exists. The system prompt is composed at
   request time and is the only place the LLM learns the tool surface.
4. **Confirm tool data resolution pins to `profileOwnerId`.** Each
   `ctx.runQuery(...)` from the tool handler must pass the
   closure-bound `profileOwnerId` (or equivalent server-derived owner)
   as the user filter — the LLM-visible args are pure data
   (`{ kind, slug }`), never user identifiers.

When the new verb is "act on a list" or "navigate to a slug,"
mirror the existing `navigateToContent` shape: the tool returns
`{ kind, slug, href, ... }` and the watcher dispatches by reading
the part type prefix (`tool-<verbName>`) and the structured `output`.

## Href-parity invariant

Client and server MUST produce the same canonical href shape. Both have
unit tests; cross-reference comments anchor the parity:

- Client: `getContentHref(username, kind, slug)` in
  [`apps/mirror/features/content/types.ts`](../../apps/mirror/features/content/types.ts).
- Server: `buildContentHref(username, kind, slug)` in
  [`packages/convex/convex/chat/toolQueries.ts`](../../packages/convex/convex/chat/toolQueries.ts).

Format: `/@<username>/<articles|posts>/<slug>`. Must stay aligned with
the Next.js route at `apps/mirror/app/[username]/<kind>/[slug]/page.tsx`.

The agent path uses the server-built `href` from `resolveBySlug`'s
result and passes it through to the dispatcher unchanged — the client
**must not** recompose the URL template. The user-UI path calls
`getContentHref` directly; the dispatcher composes the URL only when
`href` is omitted by the caller.

A divergence between the two builders silently routes the agent to a
404 while users keep working. If you change the URL template, change
both helpers and both tests in the same commit.

## Footguns

- **Tools cannot navigate from the server.** The handler returns a
  structured result; the client watcher dispatches `router.push`.
- **Watcher idempotency.** Tool-result parts re-render many times during
  streaming and after persistence. Track handled `toolCallId`s in a ref
  so a single tool call dispatches navigation exactly once.
- **Watcher only fires on `state === "output-available"`.** Streaming
  inputs and `output-error` states are NOT navigation triggers — the
  agent's text recovery handles error paths.
- **No `userId` in `inputSchema`.** This is the cross-user boundary.
  The `tools.test.ts` invariants block exists specifically to catch
  regressions here.
- **System-prompt vocabulary.** A new tool registered in
  `buildCloneTools` without a matching mention in `TOOLS_VOCABULARY` is
  a discoverability gap — the LLM will not call a verb it does not
  know exists.
