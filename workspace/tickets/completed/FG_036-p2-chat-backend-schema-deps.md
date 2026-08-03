---
id: FG_036
title: "Initialize Backend Schema and Dependencies for AI Chat"
date: 2026-02-28
type: chore
status: completed
priority: p2
description: "Install Convex AI components, add the chat conversations schema, and update the users schema with chat fields."
dependencies: []
parent_plan_id: docs/plans/2026-02-28-feat-chat-thread-digital-clone-plan.md
acceptance_criteria:
  - "@convex-dev/agent and @convex-dev/rate-limiter dependencies are installed in package.json"
  - "Convex config defines agent and rate-limiter components"
  - "Conversations table is defined in chat/schema.ts"
  - "Convex types generate successfully via `pnpm exec convex codegen` without errors"
owner_agent: "Backend Engineer"
---

# Initialize Backend Schema and Dependencies for AI Chat

## Context

We are building a real-time chat thread to Mirror's profile page that lets viewers converse with an LLM-powered digital clone of the profile owner. The foundation requires installing Convex AI agent and rate limiter components, setting up the `conversations` metadata table, and adding specific settings on the `users` table for controlling auth and personas.

## Goal

Install necessary backend packages and define the schema for conversations and the updated user settings so that backend chat functions have the required tables.

## Scope

- Install `@convex-dev/agent` and `@convex-dev/rate-limiter` packages.
- Add `convex.config.ts`.
- Create `chat/schema.ts` with the `conversations` table.
- Link the new table to the root `schema.ts`.

## Out of Scope

- Implementing the chat mutations, queries, or actions.
- Frontend interaction.

## Approach

Use `pnpm` to install dependencies in `packages/convex`. Follow the standard Convex documentation to register the components in a new `convex.config.ts`. Add the fields to `users` and define the `conversations` table according to the plan.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. In `packages/convex`, run `pnpm install @convex-dev/agent @convex-dev/rate-limiter`.
2. Create `packages/convex/convex/convex.config.ts` and define/register `agent` and `rateLimiter` components.
3. Create `packages/convex/convex/chat/schema.ts` to define the `conversations` table with: `profileOwnerId`, `viewerId` (optional), `threadId`, `status`, `title`, and `streamingInProgress` (optional boolean lock).
4. Update `packages/convex/convex/schema.ts` to export the chat schema.
5. Run `pnpm exec convex codegen` or `pnpm build` in `packages/convex` to verify the schema compiles correctly.

## Constraints

- Use Convex `v` validator for the schema.
- Messages table is managed by the Convex Agent internally, so do not create it.

## Resources

- [Plan Draft](docs/plans/2026-02-28-feat-chat-thread-digital-clone-plan.md)
