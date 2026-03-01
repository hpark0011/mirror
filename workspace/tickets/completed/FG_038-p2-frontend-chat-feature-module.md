---
id: FG_038
title: "Build Frontend Chat Feature Module Components"
date: 2026-02-28
type: feature
status: completed
priority: p2
description: "Create React components and hooks in `features/chat/` for the Chat Thread, completely independent of the Profile context."
dependencies:
  - "FG_037"
parent_plan_id: docs/plans/2026-02-28-feat-chat-thread-digital-clone-plan.md
acceptance_criteria:
  - "`features/chat/index.ts` cleanly exports components without leaking internal states"
  - "`useUIMessages` retrieves messages from the agent hook correctly in `use-chat.ts`"
  - "`ChatThread` composes message list, header, and input components cleanly"
  - "Message bubbles align user (blue, right) vs assistant (white, left) distinctively"
owner_agent: "Frontend Engineer"
---

# Build Frontend Chat Feature Module Components

## Context

For the Digital Clone chat, we must encapsulate all chat UI concerns. To prevent the Profile module from becoming bloated, we are creating a `features/chat/` domain holding the `ChatThread` interface. The `ChatThread` connects to the Convex agent via the `useUIMessages` hook.

## Goal

Create a stand-alone React module (`features/chat`) with strict typing, React Context, and components to render the real-time scrolling view.

## Scope

- Create chat types in `features/chat/types.ts`.
- `features/chat/context/chat-context.tsx` and hooks `use-chat.ts`, `use-conversations.ts`.
- Modular UI components: `chat-header.tsx`, `chat-message.tsx`, `chat-message-list.tsx`, `chat-input.tsx`, `chat-thread.tsx`, `conversation-list.tsx`.
- Explicit privacy disclaimers under the input.

## Out of Scope

- Profile view transitions, Framer motion collapse/reveal animations inside `profile-shell.tsx` (Handled by FG_039).

## Approach

Use `@convex-dev/agent/react` hooks to establish local state bindings to Convex's streaming backend. Compose UI components predictably, accepting raw data like `profileOwnerId` and callbacks (`onBack`) rather than specialized contextual records.

- **Effort:** Medium
- **Risk:** Low

## Implementation Steps

1. Scaffold out type exports in `apps/mirror/features/chat/types.ts`. Add `ChatMessage`, `Conversation` derived logic here.
2. Form hooks: `apps/mirror/features/chat/hooks/use-chat.ts` tying the mutation and `useUIMessages`, plus `use-conversations.ts` resolving previous conversations.
3. Create `ChatProvider` wrapping conversation states in `apps/mirror/features/chat/context/chat-context.tsx`.
4. Implement display models: `chat-header.tsx` with identity display, `chat-message.tsx` featuring standard alternating sides format depending on `role`.
5. Connect scrolling bounds inside `chat-message-list.tsx`.
6. Form the standalone internal input component `chat-input.tsx` specifying a warning note "Conversations may be visible to [profile name]".
7. Connect all of these inside `chat-thread.tsx` establishing a barrel export file `.ts` in the module directory.

## Constraints

- No `Profile` type references imported in `features/chat/` (clean module boundary).
- Expose components appropriately without prop-drilling internal states.

## Resources

- [Plan Draft](docs/plans/2026-02-28-feat-chat-thread-digital-clone-plan.md)
