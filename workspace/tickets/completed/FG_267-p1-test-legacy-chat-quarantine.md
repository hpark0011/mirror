---
id: FG_267
title: "Legacy configuration chats stay quarantined at every boundary"
date: 2026-08-03
type: improvement
status: completed
priority: p1
description: "Add regression coverage proving private legacy configuration conversations cannot be listed, read, sent, retried, or streamed."
dependencies: []
parent_plan_id: workspace/plans/2026-08-03-remove-clone-settings-pages-plan.md
acceptance_criteria:
  - "Tests seed both a mode: configuration row and a surviving public conversation row."
  - "getConversations, getConversation, listThreadMessages, and internalGetConversation hide the configuration row while returning the public row where authorized."
  - "sendMessage, retryMessage, and loadStreamingContext reject the configuration row before message persistence, lock changes, or stream scheduling."
  - "pnpm --filter=@feel-good/convex test exits 0 with the new quarantine cases enabled."
owner_agent: "Chat Backend Test Developer"
---

# Legacy configuration chats stay quarantined at every boundary

## Context

Release A adds independent quarantine guards in
`packages/convex/convex/chat/queries.ts:34-164`,
`packages/convex/convex/chat/mutations.ts:48-225`, and
`packages/convex/convex/chat/helpers.ts:233-320`. The new
`legacyConfigurationCleanup.test.ts` covers deletion mechanics only; no test
invokes these list, read, send, retry, or streaming boundaries with a legacy
configuration row. A guard regression could expose private configuration
messages or resume the removed agent without failing the suite.

## Goal

Every Release A access path has deterministic regression coverage that keeps
legacy configuration conversations invisible and inert.

## Scope

- Cover all public and internal conversation-read boundaries.
- Cover send, retry, and streaming-context rejection.
- Assert rejection occurs before state-changing work.

## Out of Scope

- Testing the destructive thread-cleanup runner, tracked separately.
- Restoring any configuration mode UI or backend behavior.

## Approach

Use a shared Convex test fixture that seeds one legacy configuration row and
one public row with distinct threads. Exercise each boundary directly and
assert both the negative quarantine behavior and the positive public-chat
control.

- **Effort:** Medium
- **Risk:** Low

## Implementation Steps

1. Add a shared legacy/public conversation seed helper under `packages/convex/convex/chat/__tests__/`.
2. Add table-driven query cases for list, direct read, thread messages, and internal read.
3. Add mutation and streaming-context cases that inspect messages, lock fields, and scheduled work after rejection.
4. Run `pnpm --filter=@feel-good/convex test` and confirm all cases pass.

## Constraints

- Tests must assert a positive public-chat control alongside each quarantine family.
- Do not depend on production data or run a live migration.

## Resources

- `workspace/plans/2026-08-03-remove-clone-settings-pages-plan.md`
- `packages/convex/convex/chat/__tests__/legacyConfigurationCleanup.test.ts`
