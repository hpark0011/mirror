---
id: FG_235
title: "Remove unused className prop forwarded through DeletePostConnector"
date: 2026-05-15
type: refactor
status: completed
priority: p2
branch: hpark0011/post-edit-delete
verification_tier: 2
description: "DeletePostConnector and DeletePostAction both gained an optional className? prop in this PR. No caller passes it: post-list-item-actions.tsx passes only testId; post-detail-toolbar.tsx passes neither. The forwarded value lands in className={cn(className)} where cn() with a single undefined arg is a no-op. Per .claude/rules/file-organization.md, connectors must read context/hooks and delegate — no markup/styling responsibility — so the prop also violates the connector rule."
dependencies: []
acceptance_criteria:
  - "grep -n 'className' apps/mirror/features/posts/components/actions/delete-post-connector.tsx returns no className-related code"
  - "grep -n 'cn(className)' apps/mirror/features/posts/components/actions/delete-post-action.tsx returns no matches"
  - "import of cn from @feel-good/utils/cn is removed from delete-post-action.tsx if no longer used"
  - "pnpm build --filter=@feel-good/mirror and pnpm lint --filter=@feel-good/mirror both pass"
---

# Remove unused className prop forwarded through DeletePostConnector

## Context

Surfaced in code review of branch `hpark0011/post-edit-delete`. The rename `detail/delete-post.tsx` → `actions/delete-post-action.tsx` added an unused `className?` prop on both `DeletePostConnector` (line 12) and `DeletePostAction` (line 30). Reviewers from convention + maintainability agreed (merged confidence 0.98). The two known callers:

- `apps/mirror/features/posts/components/list/post-list-item-actions.tsx:54-58` passes `testId="post-list-delete-btn"` only.
- `apps/mirror/features/posts/components/detail/post-detail-toolbar.tsx:26` passes neither.

`apps/mirror/features/posts/components/actions/delete-post-action.tsx:53` is `className={cn(className)}` — `cn(undefined)` is a no-op.

## Scope

- Drop `className?` from both component prop types.
- Remove `className={cn(className)}` and the now-unused `cn` import.

## Approach

Straight deletion — no caller needs the affordance. If a future visual variant is needed, model it as a named `variant`/`size` prop rather than raw `className`.

## Implementation Steps

1. Remove `className?: string` from `DeletePostConnectorProps` in `apps/mirror/features/posts/components/actions/delete-post-connector.tsx`.
2. Stop passing `className` to `DeletePostAction` from the connector.
3. Remove `className?: string` from `DeletePostActionProps` in `apps/mirror/features/posts/components/actions/delete-post-action.tsx`.
4. Replace `className={cn(className)}` with no `className` prop on `<Button>` (or remove the attribute entirely).
5. Remove `import { cn } from "@feel-good/utils/cn";` if no longer used in the file.
6. Run `pnpm build --filter=@feel-good/mirror` and `pnpm lint --filter=@feel-good/mirror`.
