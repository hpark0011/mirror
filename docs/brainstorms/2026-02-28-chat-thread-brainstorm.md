# Chat Thread with Digital Clone

**Date:** 2026-02-28
**Status:** Brainstorm
**Feature area:** Mirror — Profile Chat

## What We're Building

When a viewer submits a message in the chat input on a profile owner's page, the left profile panel transitions into a chat thread interface. The viewer converses with a digital clone of the profile owner, powered by an LLM that uses the owner's articles, bio, and a custom persona prompt as context.

**Key behaviors:**
- First message triggers a "collapse + reveal" transition: profile content collapses upward into a compact header (Back button, avatar/name, + button), revealing the chat thread below
- Messages stream token-by-token from the LLM
- Conversations are persisted in Convex (messages table + conversations table)
- "Back" returns to the profile view
- "+" starts a new conversation
- Profile owners can configure whether authentication is required to chat

## Why This Approach

**Approach A: Separate Chat Feature Module** — chosen over embedding chat inside the profile feature or a hybrid split.

Rationale:
- Follows the established `features/video-call/` pattern for media interactions
- Clean separation: chat logic (context, hooks, Convex integration) stays independent of profile concerns
- Profile shell orchestrates the transition but delegates chat rendering to the chat feature
- Easier to test, maintain, and extend (e.g., conversation history page later)

## Key Decisions

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| Architecture | Separate `features/chat/` module | Follows video-call pattern, clean boundaries |
| AI Backend | Convex AI action calling LLM API | Convex actions can run server-side, handle secrets, stream |
| LLM Provider | Provider-agnostic interface | Swap between Claude/OpenAI/etc. without changing chat code |
| Clone Context | Articles + bio + custom persona prompt | Rich context for authentic responses; persona prompt gives owners control |
| Response Delivery | Token streaming | More engaging UX, expected in 2026 chat interfaces |
| Persistence | Full persistence in Convex | Conversations + messages tables; users can resume past chats |
| Auth Requirement | Configurable by profile owner | Owner decides if anonymous visitors can chat |
| Transition | Collapse + reveal animation | Profile collapses into compact header, chat thread appears below |
| "+" Button | Start new conversation | Creates fresh thread; past conversations remain accessible |

## Data Model (Conceptual)

```
conversations
  - _id
  - profileOwnerId (ref -> users)
  - viewerId (ref -> users, nullable if anonymous allowed)
  - status: "active" | "archived"
  - title (first message snippet, set at creation)
  - indexes: by_profileOwnerId_and_viewerId, by_viewerId

messages
  - _id
  - conversationId (ref -> conversations)
  - role: "user" | "assistant"
  - content: string
  - status: "complete" | "streaming" | "error"  # replaces boolean isStreaming
  - indexes: by_conversationId

users table (additions)
  - personaPrompt: string (optional)     # custom clone persona prompt
  - chatAuthRequired: boolean            # whether viewers must be logged in to chat
```

### Streaming Mechanism

Use **Convex real-time subscriptions** (not HTTP streaming):
1. Convex action creates a message doc with `content: ""`, `status: "streaming"`
2. Action calls LLM streaming API, patches `content` incrementally via `ctx.db.patch`
3. Client subscribes to messages via `useQuery` — real-time updates render tokens progressively
4. On completion: patch `status: "complete"`. On error: patch `status: "error"`
5. Requires `"use node"` runtime for LLM SDK streaming APIs

This avoids the `isStreaming: boolean` crash hazard — if the action fails, a scheduled cleanup can detect stale `"streaming"` messages and mark them `"error"`.

### Rate Limiting

Use `@convex-dev/rate-limiter` in the send-message mutation. Enforce server-side only (not client-side). Storage via the rate limiter's built-in mechanism.

## Component Structure (Conceptual)

```
features/chat/
  components/
    chat-thread.tsx          # Main thread container (messages + input)
    chat-header.tsx          # Compact header (Back, avatar/name, +)
                             # Accepts profileName, avatarUrl as props (not Profile type)
    chat-input.tsx           # Chat-mode input (calls use-chat send, distinct from profile ChatInput)
    chat-message.tsx         # Single message bubble
    chat-message-list.tsx    # Scrollable message list
    conversation-list.tsx    # Sidebar listing past conversations
  context/
    chat-context.tsx         # Active conversation, messages. Accepts Id<"users"> not Profile type
  hooks/
    use-chat.ts              # Send message, subscribe to streaming response
    use-conversations.ts     # List/create/switch conversations
  types.ts
```

**ChatInput split:** The existing `features/profile/components/chat-input.tsx` becomes the "trigger" input (first message opens chat). A separate `features/chat/components/chat-input.tsx` handles in-thread messaging with `use-chat` integration. This avoids cross-feature dependency.

## Profile Shell Integration

```
profile-shell.tsx changes:
  - Replace chatOpen boolean with activeView: "profile" | "chat"
  - ChatInput.isOpen derives from activeView (not separate boolean)
  - When activeView === "chat", left panel renders ChatThread instead of ProfileInfo
  - Transition orchestrated via framer-motion (collapse + reveal)
  - Profile ChatInput triggers view transition on first send
  - Chat ChatInput handles subsequent messages within the thread

Mobile:
  - When activeView === "chat", bypass MobileProfileLayout entirely
  - Render full-screen ChatThread with own layout (no drawer)
  - Back button returns activeView to "profile", restoring MobileProfileLayout
```

## Resolved Questions

1. **Conversation list UI** — Conversation list sidebar. Users can browse and switch between past conversations.
2. **Mobile behavior** — Chat replaces the profile entirely on mobile (full screen takeover). Back button returns to profile.
3. **Rate limiting** — Yes, implement rate limits (daily/hourly caps per viewer) to control LLM costs.
4. **Persona prompt editor** — Dedicated section in the profile owner's settings/dashboard page.
