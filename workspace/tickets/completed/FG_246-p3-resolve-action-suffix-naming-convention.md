---
id: FG_246
title: "Resolve -action.tsx suffix against the file-organization naming table"
date: 2026-05-15
type: refactor
status: completed
priority: p3
branch: hpark0011/post-edit-delete
verification_tier: 2
description: "The renamed delete-post-action.tsx uses the suffix `-action.tsx`, which is not documented in .claude/rules/file-organization.md. The table defines only `-connector.tsx`; everything else (UI, presentational, dialogs) uses no suffix. The original name `delete-post.tsx` was conformant. Either revert the suffix or formally document `-action.tsx` in the suffix table."
dependencies: []
acceptance_criteria:
  - "Either: the file is renamed back to delete-post.tsx and the export reverts to DeletePost; all callers updated"
  - "Or: .claude/rules/file-organization.md's suffix table includes `-action.tsx` with a definition of when to use it (and the rest of the codebase is consistent with that definition)"
  - "pnpm build --filter=@feel-good/mirror passes"
---

# Resolve -action.tsx suffix against the file-organization naming table

## Context

Surfaced in code review of branch `hpark0011/post-edit-delete`. `.claude/rules/file-organization.md` table:

| Suffix | Meaning | Example |
|--------|---------|---------|
| `-connector.tsx` | Reads context/hooks, delegates to a UI component. | `article-list-toolbar-connector.tsx` |
| *(none)* | Everything else — UI, presentational, interactive, dialogs. | `article-list-toolbar.tsx` |

The renamed `apps/mirror/features/posts/components/actions/delete-post-action.tsx` (formerly `detail/delete-post.tsx`) uses an undocumented `-action.tsx` suffix even though it is a full UI/dialog component. The suffix is also overloaded with Next.js Server Actions, which is confusing in a React app.

## Scope

- Pick one of: revert to `delete-post.tsx` OR document `-action.tsx` in the rule.

## Approach

The simpler fix is to revert. The new directory name `actions/` already conveys grouping, and the file inside it just being `delete-post.tsx` is consistent with how the rest of the codebase names UI components.

## Implementation Steps

1. Decide on the team's preferred convention.
2. If reverting: rename `apps/mirror/features/posts/components/actions/delete-post-action.tsx` → `apps/mirror/features/posts/components/actions/delete-post.tsx`; rename export `DeletePostAction` back to `DeletePost`; update the one importer (`delete-post-connector.tsx`).
3. If documenting: extend the suffix table in `.claude/rules/file-organization.md` with a precise definition of when `-action.tsx` applies vs. when not.
4. Run `pnpm build --filter=@feel-good/mirror` and `pnpm lint --filter=@feel-good/mirror`.
