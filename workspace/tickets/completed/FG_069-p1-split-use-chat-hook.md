---
id: FG_069
title: "Chat hook splits into focused single-responsibility hooks"
date: 2026-04-23
type: refactor
status: completed
priority: p1
description: "apps/mirror/features/chat/hooks/use-chat.ts is 432 lines and combines a Convex conversation query, useUIMessages streaming pagination, two mutations (send/retry), 5 useState + 6 useEffect for optimistic UI, error classification, and optimistic/real message merge logic. Decompose into roughly three cohesive hooks so each has a single responsibility and is independently testable. Public consumer surface for chat-thread.tsx must remain stable."
dependencies: []
parent_plan_id: workspace/research/convex-nextjs-client-feature-org.md
acceptance_criteria:
  - "apps/mirror/features/chat/hooks/use-chat.ts is under 150 lines (verified via wc -l)"
  - "At least two additional hook files exist under apps/mirror/features/chat/hooks/ with distinct responsibilities (e.g. messages stream, send/retry, optimistic merge)"
  - "grep -cE '^\\s*(const|let)\\s+\\[[^]]+\\]\\s*=\\s*useState' apps/mirror/features/chat/hooks/use-chat.ts returns fewer than 3"
  - "grep -cE 'useEffect\\(' apps/mirror/features/chat/hooks/use-chat.ts returns fewer than 3"
  - "apps/mirror/features/chat/components/chat-thread.tsx public props are unchanged (verified via git diff -- apps/mirror/features/chat/components/chat-thread.tsx and absence of any consumer-side type breaks in pnpm build)"
  - "pnpm --filter=@feel-good/mirror build exits 0"
  - "pnpm --filter=@feel-good/mirror lint produces 0 errors"
owner_agent: "general-purpose"
---

# Chat hook splits into focused single-responsibility hooks

## Context

`apps/mirror/features/chat/hooks/use-chat.ts` is 432 lines (verified via `wc -l`) and is the highest-coupling hub identified in the client-side organization research at `workspace/research/convex-nextjs-client-feature-org.md`. It simultaneously owns:

- A Convex `useQuery` for conversation metadata.
- `useUIMessages` for streaming paginated messages.
- Two `useMutation` calls (`sendMessage`, `retryMessage`).
- Optimistic UI state — 5 `useState` declarations and 6 `useEffect` lifecycles (sendError, sendAnimationKey, optimisticMessages, pendingAssistantMessage, createdConversationRef).
- Merge logic that splices optimistic messages into the streamed real-message list.
- Error classification for retry recovery.
- Public exports: `sendMessage`, `retryMessage`, `clearSendError`, `mergedMessages`, `isResponding`, `resolvedStatus`.

This file is the canonical example of the "fat hook" failure mode the research report flagged. It also exceeds the spirit of the `~100 lines` ceiling in `.claude/rules/react-components.md` applied to hooks, and there is no documented rationale for the consolidation. The single consumer is `apps/mirror/features/chat/components/chat-thread.tsx`.

## Goal

`use-chat.ts` (or its replacement composition) is under 150 lines, with the message stream, send/retry mutations, and optimistic merge logic each owned by a separate, independently testable hook. `chat-thread.tsx` consumes the same public surface it does today — no observable behavior change.

## Scope

- Decompose `use-chat.ts` into ~3 hooks, e.g. `use-chat-messages.ts` (Convex query + streaming pagination), `use-chat-send.ts` (send/retry mutations + error classification), `use-chat-optimistic.ts` (optimistic state + merge with real messages).
- Either keep `use-chat.ts` as a thin composition root that re-exports the same public surface, or update `chat-thread.tsx` import sites if that's cleaner.
- Co-locate any private helpers each hook needs inside its own module — do not leave a shared utility file unless genuinely shared.
- Confirm streaming pagination cursor and optimistic message ordering remain identical via Chrome MCP interaction.

## Out of Scope

- Changing `chat-thread.tsx`'s rendering, props, or component tree.
- Touching server-side Convex chat code in `packages/convex/convex/chat/**`.
- Adding new chat features (streaming improvements, retry UX changes, error toasts) — behavior preservation only.
- Adopting a context for chat state (the existing `chat-context.tsx` carries navigation/identity only — keep that boundary intact).

## Approach

Read `use-chat.ts` end-to-end and identify the natural seams: the Convex subscription + pagination layer (read-only data), the mutation layer (writes + their lifecycle effects), and the optimistic state machine that merges between them. Each seam becomes its own hook. Compose them in a thin `use-chat.ts` that returns the same public shape.

Risk areas: (a) optimistic merge order — `mergedMessages` must produce the same sequence; (b) streaming pagination cursor — must not double-fetch or skip pages on hook re-mount; (c) error recovery on retry — `clearSendError` must still reset state in the right place. Verify each via Chrome MCP before marking complete.

- **Effort:** Medium
- **Risk:** Medium

## Implementation Steps

1. Read the entire current `apps/mirror/features/chat/hooks/use-chat.ts` and map each `useState`/`useEffect`/`useMutation`/`useQuery` to one of three buckets: messages, send, optimistic.
2. Extract `apps/mirror/features/chat/hooks/use-chat-messages.ts` containing the conversation `useQuery` + `useUIMessages` streaming pagination.
3. Extract `apps/mirror/features/chat/hooks/use-chat-send.ts` containing `sendMessage`/`retryMessage` mutations, `sendError` state, `clearSendError`, and error classification.
4. Extract `apps/mirror/features/chat/hooks/use-chat-optimistic.ts` containing optimistic message state, the merge function that produces `mergedMessages`, and the lifecycle effects that reconcile optimistic vs. real messages.
5. Reduce `use-chat.ts` to a composition root that calls the three new hooks and returns the same public shape consumed by `chat-thread.tsx`.
6. Run `pnpm --filter=@feel-good/mirror build && pnpm --filter=@feel-good/mirror lint`.
7. Verify in Chrome MCP per `.claude/rules/verification.md` Tier 4: send a message (golden path), force a send failure and retry, observe streaming reception, and switch conversations to confirm cursor reset.

## Constraints

- Public return shape of `use-chat` (or whatever `chat-thread.tsx` imports) must remain identical — no breaking changes to the consumer.
- No behavior changes — every observable interaction in chat-thread must be identical before/after.
- Do not add a context or provider for chat state — keep state local to the composition root.
- Each new hook file should respect the spirit of the 100-line ceiling; if any single hook still exceeds ~150 lines, decompose further.

## Resources

- Research report (motivation): `workspace/research/convex-nextjs-client-feature-org.md`
- Current implementation: `apps/mirror/features/chat/hooks/use-chat.ts` (432 lines)
- Single consumer: `apps/mirror/features/chat/components/chat-thread.tsx` (171 lines)
- Convex chat surface: `packages/convex/convex/chat/{queries,mutations}.ts` (do not modify)
- Convention: `.claude/rules/file-organization.md`, `.claude/rules/react-components.md`
- Verification protocol: `.claude/rules/verification.md` Tier 4
