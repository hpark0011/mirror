---
id: FG_233
title: "Lift useDeletePost out of per-row mount on the owner post list"
date: 2026-05-15
type: perf
status: completed
priority: p1
branch: hpark0011/post-edit-delete
verification_tier: 4
description: "Each owner post row now mounts a full useDeletePost hook tree (useMutation + withOptimisticUpdate useMemo + 2 useState + useRef + 3 useCallback) inside a CSS-hidden container that React still executes. For N posts that is O(N) hook trees allocated on first paint with no upper bound — the underlying api.posts.queries.getByUsername has no take() cap (see FG_248)."
dependencies:
  - FG_248
acceptance_criteria:
  - "DeletePostConnector is mounted at most once on the post list screen (lift to ScrollablePostList or PostListContext)"
  - "Each PostListItem row no longer calls useDeletePost — confirm via grep: grep -n 'useDeletePost' apps/mirror/features/posts/components/list/ returns no matches"
  - "Existing e2e post-list-actions.authenticated.spec.ts and post-delete.authenticated.spec.ts both pass"
  - "Chrome MCP screenshot of /@test-user/posts confirms Edit and Delete buttons still appear on hover at the row's top-right"
---

# Lift useDeletePost out of per-row mount on the owner post list

## Context

Surfaced in code review of branch `hpark0011/post-edit-delete`. The new `<PostListItemActions>` renders `<DeletePostConnector>` inside every row's hidden hover overlay (`apps/mirror/features/posts/components/list/post-list-item-actions.tsx:30-57`). `DeletePostConnector` calls `useDeletePost({ postId, username })` (`apps/mirror/features/posts/hooks/use-delete-post.ts`), which allocates:

- 1 `useMutation` + 1 `withOptimisticUpdate`-wrapped `useMemo`
- 2 `useState` + 1 `useRef`
- 3 `useCallback`

per row. `display: none` does not unmount React subtrees, so all N hook trees mount on first paint for the owner.

## Scope

- Mount the delete-mutation + dialog state ONCE at the list level.
- Each row exposes only a trigger that asks the list to open the dialog for `post._id`.

## Approach

Hoist the hook to `ScrollablePostList` (or a small helper component just below it). Render a single `<AlertDialog>` controlled by `{ open: boolean, targetPost: PostSummary | null }`. Each row's Delete button calls `openDeleteDialog(post)` via context or a passed callback. The optimistic-update wrapper still keys on `[removeMutation, username]` so list-level memoization stays cheap.

## Implementation Steps

1. Move `useDeletePost` call out of `DeletePostConnector` and up to a list-level component (`ScrollablePostList` or a new `PostListActionsProvider`).
2. Expose `requestDelete(post: PostSummary)` and `requestEdit(post: PostSummary)` (or just the delete) through context or a callback prop.
3. Update `PostListItemActions` so the Delete button only calls the callback — no `DeletePostConnector` mount per row.
4. Render a single `<AlertDialog>` at the list level controlled by the lifted state.
5. Keep the detail-page caller (`post-detail-toolbar.tsx`) using `DeletePostConnector` unchanged — its single-instance use stays valid.
6. Run `pnpm --filter=@feel-good/mirror test:e2e post-list-actions.authenticated.spec.ts post-delete.authenticated.spec.ts`.
7. Chrome MCP: verify hover, Edit click, Delete click, confirm, and toast behavior at `/@test-user/posts`.

## Out of Scope

- Adding pagination to `getByUsername` (tracked in FG_248).
- Lifting Tooltip/Portal providers (tracked in FG_243, FG_244).
