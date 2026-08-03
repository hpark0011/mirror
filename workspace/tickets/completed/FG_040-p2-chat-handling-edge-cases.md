---
id: FG_040
title: "Polish Chat Handling: Edge Cases, Error States, and Cleanup"
date: 2026-02-28
type: improvement
status: to-do
priority: p2
description: "Implement UX polish, stale stream cleanup cron jobs, and UI error states for the Chat feature."
dependencies:
  - "FG_039"
parent_plan_id: docs/plans/2026-02-28-feat-chat-thread-digital-clone-plan.md
acceptance_criteria:
  - "Send button is disabled while `conversation.streamingInProgress === true`"
  - "UI displays an error state for failed streaming messages alongside partial content, offering a retry button"
  - "Agent API retry behavior schedules new `streamResponse` actions, and `loadPersonaContext` ignores errored context"
  - "Cron job clears locks on conversations with `streamingInProgress: true` exceeding 2 minutes"
  - "ChatThread displays a default system prompt welcome message if no messages exist yet"
owner_agent: "Full Stack Engineer"
---

# Polish Chat Handling: Edge Cases, Error States, and Cleanup

## Context

The core features (backend mutations, modular UI, profile shell routing) for the Digital Clone chat have been completed. To reach production grade, we must ensure users cannot break the UI with spam. Also, we must gracefully handle LLM errors or application crashes, requiring features like rate limiting disclosures, UI error states, unauthenticated sign-in gates, and cron job cleanup operations.

## Goal

Wrap up all edge cases ensuring that errors or slow operations (streaming/api failures) display correct error logic. Allow manual retries for API failures and configure fallback systems preventing stale locks in the backend.

## Scope

- Surface rate limit catches natively in `ChatInput` (display inline error).
- Attach retry logic invoking agent API hooks directly and update UI for aborted/errored models within `chat-message.tsx`.
- Disable standard inputs if locking is true.
- Finish stale stream crons in `packages/convex/convex/crons.ts`.
- Fallbacks for profiles with no author tagline or published content.

## Out of Scope

- Core functionality routing for agents (FG_036/FG_037/FG_038/FG_039).

## Approach

Augment currently connected hooks inside `features/chat/` applying conditional disabled attributes. Write simple JSX elements appending to partial errors if caught. Deploy convex cron wrappers executing updates across `conversations` where locks exceed threshold timers.

- **Effort:** Medium
- **Risk:** Low

## Implementation Steps

1. In `apps/mirror/features/chat/components/chat-input.tsx`, trap `ConvexError` outputs originating from sending issues (e.g., rate limits). Display inline textual warnings like "Rate limit reached."
2. Wire `disable` properties on inputs listening to `conversation.streamingInProgress` state.
3. Establish visual "Retry" UI actions in `chat-message.tsx` shown conditionally based on status.
4. Implement the empty state UI rendering "You are a digital clone of [name]. Answer based on their writing" when no messages exist.
5. Finalize backend stale-lock cleanup for conversations retaining `streamingInProgress: true` longer than 2 minutes.

## Constraints

- Error state displays partial text content instead of wiping user inputs.

## Resources

- [Plan Draft](docs/plans/2026-02-28-feat-chat-thread-digital-clone-plan.md)
