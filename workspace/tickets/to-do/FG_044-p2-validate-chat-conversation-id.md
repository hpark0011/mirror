---
id: FG_044
title: "Chat deep links reject malformed conversation IDs safely"
date: 2026-03-03
type: fix
status: to-do
priority: p2
description: "Malformed conversationId route params are currently cast directly to Convex IDs in the chat route controller, which can bypass the intended not-available UX and trigger validation failures during deep-link navigation."
dependencies: []
parent_plan_id: docs/plans/2026-03-01-feat-chat-deep-link-urls-plan.md
acceptance_criteria:
  - "`rg -n 'raw as Id<\"conversations\">' apps/mirror/app/\\[username\\]/_providers/chat-route-controller.tsx` returns no matches."
  - "`rg -n 'parseConversationId|isValidConversationId|safeConversationId' apps/mirror/app/\\[username\\]/_providers/chat-route-controller.tsx` returns at least one match showing runtime validation before producing an `Id<\"conversations\">`."
  - "`pnpm -C apps/mirror build` succeeds."
owner_agent: "Type-safe routing and Convex ID validation specialist"
---

# Chat deep links reject malformed conversation IDs safely

## Context

The chat route controller currently derives `conversationId` from route params and casts it directly (`raw as Id<"conversations">`) in `apps/mirror/app/[username]/_providers/chat-route-controller.tsx`. This trusts arbitrary URL input as a valid Convex ID shape.

Deep-link UX relies on rendering "This conversation is not available." for inaccessible/missing conversations, but malformed IDs should be filtered before Convex query validation to avoid error-path divergence.

This was identified during architecture review after the `@interaction` migration: route ownership is improved, but ID parsing remains unsafe at the route boundary.

## Goal

Ensure malformed deep-link IDs are safely normalized before they reach chat queries so chat routes degrade predictably instead of relying on unsafe casts.

## Scope

- Add runtime validation/parsing for `params.conversationId` in the chat route controller.
- Remove direct type-cast trust from URL param to Convex ID type.
- Preserve current behavior for valid IDs and `null` IDs.

## Out of Scope

- Changing Convex schema or server validators.
- Redesigning chat access-control policy.
- Altering URL format for chat routes.

## Approach

Introduce a small route-boundary parser in `chat-route-controller.tsx` (or colocated helper) that returns `Id<"conversations"> | null`. Invalid shapes should resolve to `null` so the UI follows existing safe branch behavior.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Update `apps/mirror/app/[username]/_providers/chat-route-controller.tsx` to replace direct cast logic with runtime parsing.
2. Ensure parsed `conversationId` remains `null` for malformed input and valid for known-good IDs.
3. Verify no call site depends on raw cast behavior.
4. Run `pnpm -C apps/mirror build`.

## Constraints

- Keep current route semantics (`/@username/chat` and `/@username/chat/[conversationId]`).
- Do not introduce server-side behavior changes for valid IDs.
- Avoid broad refactors outside route-boundary parsing.

## Resources

- `apps/mirror/app/[username]/_providers/chat-route-controller.tsx`
- `apps/mirror/features/chat/hooks/use-chat.ts`
- `packages/convex/convex/chat/queries.ts`
