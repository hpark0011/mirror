---
id: FG_043
title: "Invalid chat deep links show not-available message"
date: 2026-03-01
type: feature
status: to-do
priority: p2
description: "When a user navigates to /@username/chat/[invalidId], show a clear 'conversation not available' message instead of silently falling through to the empty welcome state. Derive conversationNotFound from the useChat hook and render it in ChatThread."
dependencies:
  - FG_042
parent_plan_id: docs/plans/2026-03-01-feat-chat-deep-link-urls-plan.md
acceptance_criteria:
  - "grep -q 'conversationNotFound' apps/mirror/features/chat/hooks/use-chat.ts confirms the derived state is exported"
  - "grep -q 'conversationNotFound' apps/mirror/features/chat/components/chat-thread.tsx confirms it is consumed and rendered"
  - "grep -q 'not available' apps/mirror/features/chat/components/chat-thread.tsx confirms the user-facing message exists"
  - "The not-found state still renders ChatHeader with a working back button (grep for ChatHeader in the not-found branch)"
  - "pnpm build --filter=@feel-good/mirror succeeds without errors"
owner_agent: "React UI and error state specialist"
---

# Invalid chat deep links show not-available message

## Context

With deep-link URLs enabled (FG_041, FG_042), users can navigate directly to `/@username/chat/[conversationId]`. If the conversation ID is invalid, doesn't exist, or the user doesn't have access, the `getConversation` query in `apps/mirror/features/chat/hooks/use-chat.ts:33-36` returns `undefined` (loading) then `null` (not found).

Currently there is no handling for this case — the UI would show the normal chat thread with no messages and no indication that anything is wrong. This is confusing for users who followed a link.

## Goal

Navigating to `/@username/chat/[invalidId]` shows a centered "This conversation is not available" message with a working back button, instead of an empty chat thread.

## Scope

- Add `conversationNotFound` derived state to `useChat` hook return value
- Add not-found rendering branch to `ChatThread` component

## Out of Scope

- Redirect to `/@username/chat` on not-found (explicit message is better UX)
- Server-side 404 responses
- Distinguishing between "not found" and "no access" (both show same message)
- Toast notifications or retry mechanisms for not-found

## Approach

In `use-chat.ts`, derive `conversationNotFound` as `conversationId !== null && conversation === null`. This is `false` when loading (`conversation` is `undefined`) and `true` only when the query has resolved and returned no result. In `chat-thread.tsx`, check this flag early and render a not-found state with the ChatHeader (for the back button) and a centered message.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. In `apps/mirror/features/chat/hooks/use-chat.ts`, add `const conversationNotFound = conversationId !== null && conversation === null;` after the `conversation` query
2. Add `conversationNotFound` to the return object of `useChat`
3. In `apps/mirror/features/chat/components/chat-thread.tsx`, destructure `conversationNotFound` from the `useChat` call
4. Add an early return before the normal render that checks `conversationNotFound` and renders `ChatHeader` + centered "This conversation is not available." message
5. Run `pnpm build --filter=@feel-good/mirror` and verify it passes

## Constraints

- The not-found state must include `ChatHeader` with a working `onBack` so the user can navigate away
- Use `text-muted-foreground` for the message to match existing design patterns
- Must not show the not-found state during loading (`conversation === undefined`)

## Resources

- Plan: `docs/plans/2026-03-01-feat-chat-deep-link-urls-plan.md` (Phase 5)
- Chat hook: `apps/mirror/features/chat/hooks/use-chat.ts:33-36`
- Chat thread: `apps/mirror/features/chat/components/chat-thread.tsx`
