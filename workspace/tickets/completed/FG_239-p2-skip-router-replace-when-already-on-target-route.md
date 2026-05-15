---
id: FG_239
title: "Skip router.replace when useDeletePost is already on the posts list URL"
date: 2026-05-15
type: fix
status: completed
priority: p2
branch: hpark0011/post-edit-delete
verification_tier: 4
description: "useDeletePost.handleConfirm calls router.replace(getContentHref(username, 'posts')) before awaiting removePosts. On the post DETAIL page this prevents a blank-flash. On the new list-mount, it is a same-URL soft navigation that can trigger SSR preload of pre-delete state, conflicting with the optimistic patch and causing the deleted row to flash back into view."
dependencies:
  - FG_233
acceptance_criteria:
  - "apps/mirror/features/posts/hooks/use-delete-post.ts no longer unconditionally calls router.replace before awaiting the mutation"
  - "When the current pathname is already the posts-list URL, the router.replace call is skipped (use usePathname or a passed-in flag)"
  - "Existing post-delete.authenticated.spec.ts (detail-page flow) still passes — the navigate-away behavior must be preserved when called from detail"
  - "New post-list-actions delete test (FG_233 path) still passes — no flash, optimistic removal renders cleanly"
---

# Skip router.replace when useDeletePost is already on the posts list URL

## Context

Surfaced in code review of branch `hpark0011/post-edit-delete`. `apps/mirror/features/posts/hooks/use-delete-post.ts:63-64` calls `router.replace(buildChatAwareHref(getContentHref(username, 'posts')))` synchronously before `await removePosts({ ids: [postId] })`. Inline comment (lines 60-62) documents the intent for the detail page (prevent blank-flash on detail unmount). The list-mount caller (new in this PR) is already at the target URL — the replace is a same-URL soft nav that can re-trigger the server preload of `getByUsername` while the mutation has not yet committed, producing a brief flash of the to-be-deleted row.

## Scope

- Make `useDeletePost` aware of whether it is invoked from the detail page or the list page, and skip the unnecessary navigation in the latter case.

## Approach

Two reasonable shapes:
1. Detect current pathname with `usePathname()` and skip `router.replace` when the user is already there.
2. Accept an explicit `navigateOnSuccess?: boolean` argument to the hook (default true for detail callers, false for list callers).

Option 2 is more explicit and easier to reason about; option 1 is mechanical but adds another hook subscription. Pick option 2 unless the lifted hook in FG_233 already implies a different structure.

## Implementation Steps

1. Decide on the API shape after FG_233 lands (the lifted hook might already know the source context).
2. Update `apps/mirror/features/posts/hooks/use-delete-post.ts` to skip `router.replace` when the caller is the list page.
3. Update detail caller (`post-detail-toolbar.tsx`) to keep the existing behavior (navigate away on success).
4. Run `pnpm --filter=@feel-good/mirror test:e2e post-delete.authenticated.spec.ts post-list-actions.authenticated.spec.ts`.
5. Chrome MCP: confirm no visible row-flash when deleting from `/@test-user/posts`.

## Constraints

- Must not regress the detail-page flow that explicitly relies on the early `router.replace` to avoid blank-flash on `PostDetailConnector` unmount.
