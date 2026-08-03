---
id: FG_266
title: "Release A preserves public chat for already-loaded clients"
date: 2026-08-03
type: fix
status: to-do
priority: p1
description: "Keep the surviving public-chat API compatible while Convex deploys ahead of the new Next client bundle."
dependencies: []
parent_plan_id: workspace/plans/2026-08-03-remove-clone-settings-pages-plan.md
acceptance_criteria:
  - "Release A validators accept the previous client's mode: clone argument for getConversations, sendMessage, and retryMessage."
  - "Requests with mode: configuration remain hidden or rejected and cannot create messages, locks, or streams."
  - "A regression test exercises previous-client argument shapes against all three surviving endpoints without validator errors."
  - "pnpm --filter=@feel-good/convex test and pnpm --filter=@feel-good/mirror build both exit 0."
owner_agent: "Chat Backend Developer"
---

# Release A preserves public chat for already-loaded clients

## Context

Code review found that `packages/convex/convex/chat/queries.ts:65-67` and
`packages/convex/convex/chat/mutations.ts:48-53,168-172` remove the `mode`
argument from surviving public-chat functions. The previous Mirror bundle always
sends `mode: "clone"` to these endpoints. The production build order in
`.claude/rules/auth.md:110-117` deploys Convex before the replacement Next
bundle is live, so existing tabs receive argument-validation errors and lose
public chat until refresh.

## Goal

Release A keeps ordinary public chat working across the Convex-first rollout
while still preventing every legacy configuration-mode operation.

## Scope

- Preserve a migration-only optional `mode` validator on the three surviving chat endpoints.
- Accept and ignore `mode: "clone"` while explicitly quarantining `mode: "configuration"`.
- Add previous-client contract coverage for query, send, and retry calls.

## Out of Scope

- Restoring configuration-chat behavior or configuration tools.
- Keeping the compatibility argument after the Release A client has aged out.

## Approach

Retain only the argument-level compatibility envelope required by the old
public client. Branch on the legacy value before any data or stream work so
configuration requests stay inert, then remove the envelope in the planned
Release B cleanup.

- **Effort:** Small
- **Risk:** Medium

## Implementation Steps

1. Add an optional migration-only `mode` argument to `chat/queries.ts:getConversations` and return no configuration rows for the removed mode.
2. Add the same optional argument to `chat/mutations.ts:sendMessage` and `retryMessage`, rejecting `configuration` before persistence, rate-limit consumption, locks, or scheduling.
3. Add focused Convex tests using the exact previous-client argument shapes for clone and configuration values.
4. Run the Convex test suite and the Mirror production build.

## Constraints

- Do not write a `mode` value to new conversation rows.
- Do not expose legacy configuration conversations or reintroduce configuration tools.
- Mark the compatibility validator for deletion in Release B.

## Resources

- `workspace/plans/2026-08-03-remove-clone-settings-pages-plan.md`
- `.claude/rules/auth.md`
