---
id: FG_037
title: "Implement Convex Backend Core Functions for Chat Agent"
date: 2026-02-28
type: feature
status: completed
priority: p2
description: "Implement Convex mutations, queries, and actions for the `@convex-dev/agent` to support the Chat Thread with Digital Clone."
dependencies:
  - "FG_036"
parent_plan_id: docs/plans/2026-02-28-feat-chat-thread-digital-clone-plan.md
acceptance_criteria:
  - "`chat/agent.ts` configures agent component"
  - "`sendMessage` mutation handles input validation, auth checking, conversation ownership, and concurrency locks"
  - "`streamResponse` action triggers `Agent.streamText()` and clears locks"
  - "`getConversations` securely returns metadata filtered by viewer or owner"
owner_agent: "Backend Engineer"
---

# Implement Convex Backend Core Functions for Chat Agent

## Context

We are adding an LLM-powered digital clone chat to Mirror profiles. The database fields have been created (FG_036). We now need the business logic in `packages/convex/convex/chat/` to safely send user messages to the `@convex-dev/agent`, stream the responses back to the database, enforce concurrency, apply context windowing, and handle rate limits.

## Goal

Create backend functions `sendMessage`, `streamResponse`, and access queries that allow clients to securely communicate with the Convex Agent component using the profile's specified context.

## Scope

- Setup `chat/agent.ts` with `Agent` configured.
- Write `chat/mutations.ts` (`sendMessage` with validation/concurrency protection, `clearStreamingLock`).
- Write `chat/actions.ts` (`streamResponse`).
- Write `chat/queries.ts` (`getConversation`, `getConversations`, `listMessages`).
- Write `chat/helpers.ts` to build the `personaPrompt` contextual payload (sliding window, max 20).
- Setup two-tier rate limiting for anon + per-user authenticated limits in `chat/rateLimits.ts`.
- Add stale stream cleanup cron in `crons.ts`.

## Out of Scope

- Frontend implementation (in FG_038/FG_039).

## Approach

Use the mutation/action pattern outlined in the specification to set up scheduling. Since actions cannot patch `ctx.db` directly, user inputs and thread state tracking should be managed strictly by Convex Agent internal storage and app-level tracking flags (`streamingInProgress`).

- **Effort:** Large
- **Risk:** Medium

## Implementation Steps

1. Create `packages/convex/convex/chat/agent.ts` to set up `Agent` provider logic.
2. Create `packages/convex/convex/chat/queries.ts` providing `getConversation` / `getConversations` to securely query user metadata.
3. Write `helpers.ts` with `loadPersonaContext`, applying the sliding window of last 20 messages and enforcing non-negotiable safety prefixes before custom persona.
4. Set up `chat/rateLimits.ts` enforcing a global limit for unauthenticated fresh threads and per-thread limits otherwise.
5. In `mutations.ts`, write `sendMessage`. Validate `content.length`, check limits, check `streamingInProgress` locks, authorize thread owners, run `.insert()` on `conversations` where missing, `.patch(..., { streamingInProgress: true })`, and use `ctx.scheduler` to run the processing task.
6. Create `actions.ts` with `streamResponse`. Use `cloneAgent.streamText(...)` catching errors correctly to trigger a `clearStreamingLock` mutation when finished.
7. Update `packages/convex/convex/crons.ts` to clear old `streamingInProgress` locks > 2m.

## Constraints

- Ensure the action executes independently of the frontend request lifecycle using `ctx.scheduler`.
- Strict boundaries applied in `getConversations` and `sendMessage` regarding who can query thread details.

## Resources

- [Plan Draft](docs/plans/2026-02-28-feat-chat-thread-digital-clone-plan.md)
