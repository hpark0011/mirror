---
id: FG_169
title: "Clone-agent has write-tool parity for status toggles and article delete"
date: 2026-05-09
type: feature
status: to-do
priority: p2
description: "The clone agent currently has only navigation tools (`navigateToContent`, `openProfileSection`) plus `deletePost`. Several user-facing write verbs (publishPost, unpublishPost, editPost, deleteArticle, publishArticle, unpublishArticle, editArticle) have no matching agent tool, breaking the agent-parity invariant. Land the simple status-toggle write-tools as a coherent set, modeled on the existing `deletePost` server-execute shape."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "`grep -nE 'publishPost|unpublishPost|deleteArticle|publishArticle|unpublishArticle' packages/convex/convex/chat/tools.ts` shows each of the five names registered as a tool inside `buildCloneTools` (e.g. `publishPost: createTool(`)."
  - "Inside each new tool's `inputSchema: z.object({ ... })` literal, `grep -nE 'userId|user_id|ownerId'` returns zero matches — only verb-specific data (`slug`, optionally `nextStatus`) is LLM-visible."
  - "`packages/convex/convex/chat/helpers.ts` `TOOLS_VOCABULARY` string references all five new verb names (one mention each minimum) so the system prompt advertises them."
  - "`pnpm --filter=@feel-good/convex test:unit -- tools` passes with new `inputSchema invariants` assertions for each of the five tools (one assertion per tool that the schema rejects a `userId` field)."
  - "`apps/mirror/features/chat/hooks/use-agent-intent-watcher.ts` declares `tool-publishPost`, `tool-unpublishPost`, `tool-deleteArticle`, `tool-publishArticle`, `tool-unpublishArticle` constants and has a dispatch branch for each in the message walker."
  - "`pnpm --filter=@feel-good/mirror lint` and `pnpm --filter=@feel-good/mirror build` both pass."
owner_agent: "Convex chat agent backend developer (chat-backend-developer)"
---

# Clone-agent has write-tool parity for status toggles and article delete

## Context

PR #68 adds a UI delete-post button and re-confirmed that the clone-agent
already has a matching `deletePost` tool registered at
`packages/convex/convex/chat/tools.ts:94-148`, with vocabulary in
`packages/convex/convex/chat/helpers.ts:80` and a watcher branch at
`apps/mirror/features/chat/hooks/use-agent-intent-watcher.ts:42,218`. The
PR review (Codex P1) flagged the broader gap: posts have a publish-toggle
UI (`apps/mirror/features/posts/hooks/use-publish-toggle.ts`) and articles
have publish-toggle, edit, and delete UI affordances, none of which have
matching agent tools.

`.claude/rules/agent-parity.md` is explicit: "Every action a user can
take through the Mirror UI, the clone agent must be able to take through
a tool. A UI verb without a matching agent tool is a parity bug, not a
feature." Landing delete-post-only would set an inconsistent precedent
(arbitrary write-tool coverage). The simple status-toggle/delete verbs
share the existing `deletePost` server-execute shape — slug-only
LLM-visible input, owner closure-bound, server-built navigation href on
return — so they can land as a coherent set.

`editPost` and `editArticle` are intentionally excluded from this ticket:
they need a different shape (interactive editor open vs. server-execute)
and warrant their own design discussion. File those as a follow-up.

## Goal

After this ticket, the clone agent can publish/unpublish a post or
article and delete an article on behalf of the profile owner, exactly
mirroring the user-UI affordances. Each new tool follows the
`deletePost` reference shape and the `inputSchema invariants` test pins
the cross-user isolation boundary for every verb.

## Scope

- Add five tools to `buildCloneTools` in
  `packages/convex/convex/chat/tools.ts`: `publishPost`, `unpublishPost`,
  `deleteArticle`, `publishArticle`, `unpublishArticle`.
- Each tool's `inputSchema` exposes only verb-data (`slug` for
  delete/publish/unpublish; status is implicit in the verb name) — no
  `userId` / `user_id` / `ownerId`.
- Each tool's handler resolves the row via the existing
  `resolveBySlug` query pinned to closure-bound `profileOwnerId`, runs
  the matching internal mutation (`api.posts.mutations.update` for
  status changes, equivalent for articles), and returns the canonical
  navigation href the watcher should dispatch to.
- Extend `TOOLS_VOCABULARY` in `packages/convex/convex/chat/helpers.ts`
  with one sentence per new verb describing trigger phrasing and the
  owner-only constraint, mirroring the existing `deletePost` sentence.
- Extend `inputSchema invariants` describe block in
  `packages/convex/convex/chat/__tests__/tools.test.ts` with one
  assertion per new tool that a `userId` field is rejected.
- Add watcher branches in
  `apps/mirror/features/chat/hooks/use-agent-intent-watcher.ts` for each
  new `tool-<verb>` part type. Dispatch via the existing
  `navigateToContent` (slug-level — for publish: navigate to the
  newly-published detail page; for unpublish/delete: navigate away to
  the list) without adding new dispatcher verbs on `useCloneActions`.
- No new `useCloneActions` verb is needed — the existing
  `navigateToContent` and `navigateToProfileSection` cover the
  post-write navigation shapes (same pattern `deletePost` uses today).

## Out of Scope

- `editPost` and `editArticle` agent tools — these need a separate
  shape decision (open the editor UI for the slug vs. accept full body
  in tool args) and should be filed as a follow-up ticket.
- Agent-initiated draft creation (`createPost`, `createArticle`) —
  also needs a separate shape decision.
- Changing the `deletePost` shape — it is the reference; do not refactor
  it as part of this ticket.
- Confirmation-required intent flow (e.g., agent asks "really delete?"
  before executing) — current `deletePost` is server-execute on call; if
  destructive write tools need user-confirmation gating, that is a
  cross-cutting design ticket, not this one.

## Approach

Mirror the existing `deletePost` tool exactly — it is the canonical
reference for "destructive write + navigate" agent verbs. The handler
shape is:

```ts
publishPost: createTool({
  description: "Publish one of the profile owner's draft posts by slug. ...",
  inputSchema: z.object({
    slug: z.string().min(1).describe("The slug of the post to publish."),
  }),
  execute: async (ctx, { slug }) => {
    const row = await ctx.runQuery(internal.chat.toolQueries.resolveBySlug, {
      userId: profileOwnerId, // closure-bound — never from args
      kind: "posts",
      slug,
    });
    if (!row) return { kind: "posts" as const, ok: false, slug, href: ... };
    await ctx.runMutation(internal.posts.mutations.update, {
      userId: profileOwnerId,
      id: row._id,
      status: "published",
    });
    return { kind: "posts" as const, ok: true, slug, href: row.href };
  },
}),
```

`unpublishPost` / `publishArticle` / `unpublishArticle` are
character-for-character duplicates with the status literal flipped and
`kind: "articles"` swapped in. `deleteArticle` mirrors `deletePost`
verbatim with `posts` → `articles`.

- **Effort:** Medium
- **Risk:** Medium — agent gains destructive write access. The
  cross-user isolation boundary (closure-bound `profileOwnerId`,
  `inputSchema` excludes user identifiers) is the defense; the
  invariants test in `tools.test.ts` pins it.

## Implementation Steps

1. Open `packages/convex/convex/chat/tools.ts:94-148` and clone the
   `deletePost` tool block five times — once for each new verb. Update
   `description`, `kind` literal, and the internal mutation reference
   per verb.
2. Verify each new tool's `execute` passes `profileOwnerId` (closure
   variable) into both `runQuery` and `runMutation` calls — never an
   arg-derived value.
3. Extend `TOOLS_VOCABULARY` in
   `packages/convex/convex/chat/helpers.ts:80` with one sentence per
   new verb. Place them after the existing `deletePost` sentence,
   keeping the "owner-only — confirm before calling" framing.
4. Add five new assertions to the `inputSchema invariants` describe
   block in
   `packages/convex/convex/chat/__tests__/tools.test.ts` — one per tool
   asserting that the `inputSchema` z-object rejects `{ userId: "..." }`
   (mirror the existing assertion for `deletePost`).
5. Add five new constants and dispatch branches to
   `apps/mirror/features/chat/hooks/use-agent-intent-watcher.ts`,
   mirroring the existing `DELETE_POST_TYPE` pattern. Each branch
   narrows the `output` shape, then calls `navigateToContent` (publish:
   navigate to the post's detail page; unpublish/delete: navigate to
   the list section).
6. Run `pnpm --filter=@feel-good/convex test:unit` and
   `pnpm --filter=@feel-good/mirror test:unit` — both must pass.
7. Run `pnpm --filter=@feel-good/mirror lint` and
   `pnpm --filter=@feel-good/mirror build` — both must pass.

## Constraints

- The `inputSchema` for every new tool MUST exclude any user identifier
  field. This is the cross-user isolation boundary; the invariants test
  is the regression guard.
- No new dispatcher verbs on `useCloneActions` — the existing
  `navigateToContent` / `navigateToProfileSection` are sufficient for
  every navigation shape these tools need (mirrors `deletePost`).
- Tool handlers do not call `router.push` — server-side cannot
  navigate. Each handler returns a structured result; the watcher
  dispatches.
- Do not refactor or rename `deletePost` — it is the reference; changes
  to it broaden this ticket's blast radius.
- `editPost` / `editArticle` stay out — file a separate ticket if/when
  the design is settled.

## Manual Verification

After unit-test acceptance criteria pass, manually verify the round-trip
for each new verb in `pnpm dev:safe` against the worktree's seeded data:

1. Sign in as the profile owner; open chat; ask "publish my draft post
   titled X". Verify the post moves to `published` and the visitor is
   navigated to `/@<owner>/posts/<slug>`.
2. Same for unpublish, deleteArticle, publishArticle, unpublishArticle.
3. As a non-owner visitor, ask the agent to publish/delete one of the
   owner's posts. Verify the agent refuses (system-prompt-level), and
   even if the call were forced, the server-side mutation rejects on
   owner mismatch (cross-user isolation as defense in depth).

## Resources

- `.claude/rules/agent-parity.md` — the four-step checklist this ticket
  applies five times.
- `.claude/rules/embeddings.md` § "Cross-user isolation invariant" —
  same boundary as RAG, extended to the action-side.
- `packages/convex/convex/chat/tools.ts:94-148` — `deletePost`
  reference implementation.
- `apps/mirror/features/chat/hooks/use-agent-intent-watcher.ts:130-235`
  — `DELETE_POST_TYPE` watcher reference.
- PR #68 review thread — Codex P1 finding that surfaced this gap.
