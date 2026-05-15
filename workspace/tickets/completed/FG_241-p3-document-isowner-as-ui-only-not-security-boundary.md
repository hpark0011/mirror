---
id: FG_241
title: "Document isOwner as UI-only gating, not a security boundary"
date: 2026-05-15
type: docs
status: completed
priority: p3
branch: hpark0011/post-edit-delete
verification_tier: 1
description: "The `if (!isOwner) return null;` guards in PostListItemActions and DeletePostConnector are ergonomic UI gating only — server-side mutations (api.posts.mutations.remove) and the /edit server-component owner check are the real trust boundary. A future reviewer could remove the server checks thinking the UI guard is sufficient. Add a clarifying comment so the intent stays explicit."
dependencies: []
acceptance_criteria:
  - "apps/mirror/features/posts/components/list/post-list-item-actions.tsx has a comment near the `if (!isOwner) return null;` line stating the gate is UI ergonomics only and pointing to the server-side trust boundaries"
  - "Comment names api.posts.mutations.remove and the /edit server component (or its file path) as the actual authorization gates"
---

# Document isOwner as UI-only gating, not a security boundary

## Context

Surfaced in code review of branch `hpark0011/post-edit-delete`. `apps/mirror/features/posts/components/list/post-list-item-actions.tsx:28` and `apps/mirror/features/posts/components/actions/delete-post-connector.tsx:24` both return `null` on `!isOwner`. The server-side checks are:

- `packages/convex/convex/posts/writeHelpers.ts` (`isOwnedByUser` inside `deletePostForUserById`)
- `apps/mirror/app/[username]/@content/posts/[slug]/edit/page.tsx` (server component owner check + redirect)

The UI gate is purely cosmetic; an attacker can flip `isOwner` in React DevTools but the server still rejects the mutation/edit.

## Scope

- Add a one- or two-line code comment near the `isOwner` guard explaining its role.

## Approach

A short inline comment is the lightest correct response — the actual server-side trust boundary is already in place; the goal is just to keep that intent visible to readers who might otherwise prune one of the redundant gates.

## Implementation Steps

1. Add a brief comment above `if (!isOwner) return null;` in `apps/mirror/features/posts/components/list/post-list-item-actions.tsx` pointing readers to `api.posts.mutations.remove` and `app/[username]/@content/posts/[slug]/edit/page.tsx` as the real authorization gates.
2. Run `pnpm build --filter=@feel-good/mirror`.
