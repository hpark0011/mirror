---
id: FG_041
title: "Chat routes resolve to correct pages via URL rewrites"
date: 2026-03-01
type: feature
status: completed
priority: p2
description: "Add Next.js route infrastructure for chat deep-link URLs so that /@username/chat and /@username/chat/[conversationId] resolve to dedicated chat route pages. Includes URL rewrites in next.config.ts, reserving 'chat' as a username, and creating the two new page files."
dependencies: []
parent_plan_id: docs/plans/2026-03-01-feat-chat-deep-link-urls-plan.md
acceptance_criteria:
  - "grep -q 'chat' apps/mirror/next.config.ts shows rewrite rules for /@:username/chat and /@:username/chat/:conversationId BEFORE the generic /@:username/:slug rewrite"
  - 'grep -q ''"chat"'' apps/mirror/lib/reserved-usernames.ts confirms ''chat'' is in the RESERVED_USERNAMES set'
  - "test -f apps/mirror/app/[username]/chat/page.tsx && test -f apps/mirror/app/[username]/chat/[conversationId]/page.tsx"
  - "grep -q 'noindex' apps/mirror/app/[username]/chat/page.tsx confirms chat pages are noindexed"
  - "Both chat page files render ScrollableArticleList and ArticleListToolbarConnector (same content as the profile page)"
  - "pnpm build --filter=@feel-good/mirror succeeds without errors"
owner_agent: "Next.js routing and config specialist"
---

# Chat routes resolve to correct pages via URL rewrites

## Context

Chat deep-link URLs (`/@username/chat/[conversationId]`) are a future consideration from the original chat plan (`docs/plans/2026-02-28-feat-chat-thread-digital-clone-plan.md`). Currently chat state is pure React state — no URL representation exists. This ticket sets up the routing layer that subsequent work (URL synchronization, access control) builds on.

The existing rewrite rules in `apps/mirror/next.config.ts:48-51` only handle `/@:username` and `/@:username/:slug`. Chat routes need dedicated rewrites inserted before the generic slug rewrite so Next.js resolves them to the `chat/` directory rather than `[slug]/`.

Additionally, `apps/mirror/lib/reserved-usernames.ts` must reserve `"chat"` to prevent a user from registering it as their username, which would collide with the static route segment.

## Goal

`/@username/chat` and `/@username/chat/[conversationId]` resolve to dedicated Next.js pages that render chat-compatible content, and the build passes.

## Scope

- Add two URL rewrite rules to `apps/mirror/next.config.ts` before the existing slug rewrite
- Add `"chat"` to `RESERVED_USERNAMES` in `apps/mirror/lib/reserved-usernames.ts`
- Create `apps/mirror/app/[username]/chat/page.tsx` (new conversation entry point)
- Create `apps/mirror/app/[username]/chat/[conversationId]/page.tsx` (existing conversation)

## Out of Scope

- URL synchronization in ProfileShell (FG_042)
- Access control / not-found UI for invalid conversation IDs (FG_043)
- Chat sidebar or conversation list navigation
- Server-side metadata beyond noindex

## Approach

Insert two rewrite rules into the existing `rewrites` array in `next.config.ts`, positioned before `/@:username/:slug` so the static `chat` segment takes precedence. Both new page files mirror the existing profile `page.tsx` content (6 lines — `WorkspaceToolbar` + `ArticleListToolbarConnector` + `ScrollableArticleList`) with added `noindex` metadata.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Add `"chat"` to the `RESERVED_USERNAMES` set in `apps/mirror/lib/reserved-usernames.ts`
2. Add rewrite rules `{ source: "/@:username/chat", destination: "/:username/chat" }` and `{ source: "/@:username/chat/:conversationId", destination: "/:username/chat/:conversationId" }` to `apps/mirror/next.config.ts` — insert BEFORE the existing `/@:username/:slug` rule
3. Create `apps/mirror/app/[username]/chat/page.tsx` with noindex metadata and the same article list content as `apps/mirror/app/[username]/page.tsx`
4. Create `apps/mirror/app/[username]/chat/[conversationId]/page.tsx` with the same content
5. Run `pnpm build --filter=@feel-good/mirror` and verify it passes

## Constraints

- Rewrite order matters: chat rewrites MUST precede the generic `/:slug` rewrite
- Chat pages must render the same right-panel content as the profile page (articles)
- No changes to ProfileShell or any existing component behavior

## Resources

- Plan: `docs/plans/2026-03-01-feat-chat-deep-link-urls-plan.md` (Phases 1-2)
- Existing rewrites: `apps/mirror/next.config.ts:48-51`
- Reserved usernames: `apps/mirror/lib/reserved-usernames.ts`
- Profile page reference: `apps/mirror/app/[username]/page.tsx`
