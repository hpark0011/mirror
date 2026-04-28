---
id: FG_071
title: "Publish toggle connector delegates without owning state"
date: 2026-04-23
type: refactor
status: completed
priority: p2
description: "apps/mirror/features/posts/components/publish-toggle-connector.tsx is named as a connector but owns dialogOpen and isPending state, calls useMutation directly, and defines three handler callbacks with a pendingRef guard. This crosses the convention that connectors are pure delegation. Extract a usePublishToggle hook so the connector reads context, calls the hook, and passes values through."
dependencies: []
parent_plan_id: workspace/research/convex-nextjs-client-feature-org.md
acceptance_criteria:
  - "apps/mirror/features/posts/hooks/use-publish-toggle.ts exists"
  - "grep -E 'useState|useMutation|useCallback' apps/mirror/features/posts/components/publish-toggle-connector.tsx returns no matches"
  - "apps/mirror/features/posts/components/publish-toggle-connector.tsx is under 30 lines (verified via wc -l)"
  - "grep -E 'useMutation|useState' apps/mirror/features/posts/hooks/use-publish-toggle.ts returns at least one match for each"
  - "pnpm --filter=@feel-good/mirror build exits 0"
  - "pnpm --filter=@feel-good/mirror lint produces 0 errors"
owner_agent: "general-purpose"
---

# Publish toggle connector delegates without owning state

## Context

`apps/mirror/features/posts/components/publish-toggle-connector.tsx` (72 lines) is suffixed `-connector.tsx`, which by `.claude/rules/file-organization.md` means: "Reads context/hooks, delegates to a UI component. No markup of its own."

In practice it owns `dialogOpen` and `isPending` state, calls `useMutation(api.posts.mutations.update)`, defines `handleConfirm`, `handleCancel`, and `handleOpenChange` callbacks with a guard-ref pattern, and conditionally returns `null` when `!isOwner`. It crosses from "pure delegation" into a mini-controller. The research report at `workspace/research/convex-nextjs-client-feature-org.md` flagged this as a connector-vs-controller boundary violation.

There is no `usePublishToggle` hook today — all the publish toggle logic lives in the connector.

## Goal

The connector becomes a pure delegation layer (≤30 lines): it reads context, calls `usePublishToggle`, and passes the resulting values into the UI component. All mutation, state, and handler logic moves into a hook that can be tested independently.

## Scope

- Create `apps/mirror/features/posts/hooks/use-publish-toggle.ts` owning `dialogOpen` state, `isPending` state, the `useMutation` call, and the three callback handlers (`handleConfirm`, `handleCancel`, `handleOpenChange`) with the guard-ref pattern.
- Reduce `publish-toggle-connector.tsx` to: read context, call `usePublishToggle`, conditionally render `null` when `!isOwner`, otherwise pass values to the underlying UI component.
- Keep the rendered output and observable behavior identical.

## Out of Scope

- Changing the publish/unpublish UI itself.
- Modifying `api.posts.mutations.update` or any Convex code.
- Other connectors in the posts feature module (e.g. `markdown-upload-dialog-connector.tsx` is borderline but not in scope).

## Approach

Move the `useState`, `useMutation`, `useCallback`, and `useRef` calls into `use-publish-toggle.ts`. The hook accepts whatever inputs it needs from the connector (e.g. `postId`, `isPublished`) and returns `{ dialogOpen, isPending, handleConfirm, handleCancel, handleOpenChange }`. The connector calls the hook with values it gets from context.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Read `apps/mirror/features/posts/components/publish-toggle-connector.tsx` end-to-end to identify the inputs it needs (postId, isPublished, etc.) and the values it passes to the UI component.
2. Create `apps/mirror/features/posts/hooks/use-publish-toggle.ts` accepting those inputs and owning the state, mutation, and handlers.
3. Update `publish-toggle-connector.tsx` to: read context, return `null` if not owner, call `usePublishToggle(...)`, pass result into the UI component. Should land under 30 lines.
4. Run `pnpm --filter=@feel-good/mirror build && pnpm --filter=@feel-good/mirror lint`.
5. Verify in Chrome MCP per `.claude/rules/verification.md` Tier 4: open a published post, toggle to unpublished via the dialog, confirm, observe state reset.

## Constraints

- Connector must contain no `useState`, `useMutation`, `useCallback`, or `useRef` calls after refactor.
- Connector must not exceed ~30 lines.
- Hook must encapsulate the guard-ref pattern correctly — no double-submission regressions.
- No behavior change: dialog open/close, pending state, and mutation execution must be observably identical.

## Resources

- Research report (motivation): `workspace/research/convex-nextjs-client-feature-org.md`
- Current implementation: `apps/mirror/features/posts/components/publish-toggle-connector.tsx` (72 lines)
- Connector convention: `.claude/rules/file-organization.md` (component naming suffixes section)
- Verification protocol: `.claude/rules/verification.md` Tier 4
