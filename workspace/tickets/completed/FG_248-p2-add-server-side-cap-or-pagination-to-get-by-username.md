---
id: FG_248
title: "Bound posts.queries.getByUsername with a server-side cap or pagination"
date: 2026-05-15
type: perf
status: completed
priority: p2
branch: hpark0011/post-edit-delete
verification_tier: 4
description: "api.posts.queries.getByUsername does a .collect() with no take() or paginate() guard. Every post by the user is returned in one response, including a Promise.all rewrite of inline image signed URLs. For high-volume authors this scales linearly. The new per-row useDeletePost (FG_233) compounds the problem — both costs grow with post count."
dependencies: []
acceptance_criteria:
  - "packages/convex/convex/posts/queries.ts either applies .take(N) for a sensible N (e.g., 100) inside getByUsername, OR exposes a paginated query and the post-list UI consumes it via usePaginatedQuery"
  - "Inline-image URL rewrites (Promise.all) operate on at most N posts per request"
  - "Existing post-list UI still renders correctly for users with fewer than N posts: pnpm --filter=@feel-good/mirror test:e2e post-list-actions.authenticated.spec.ts post-delete.authenticated.spec.ts pass"
  - "Chrome MCP confirms /@test-user/posts renders within 1s for typical accounts"
---

# Bound posts.queries.getByUsername with a server-side cap or pagination

## Context

Surfaced in code review of branch `hpark0011/post-edit-delete` (flagged pre-existing). `packages/convex/convex/posts/queries.ts:71-74` performs `.collect()` on the user's posts index without a row cap, then does `Promise.all` over inline-image URL rewrites for every post. With the new per-row `useDeletePost` introduced in this branch (FG_233), the per-list cost now scales O(N posts) on both server and client.

## Scope

- Apply a server-side cap or switch to pagination on `getByUsername`.
- Update consumers if pagination is chosen.

## Approach

Two options:
1. **Quick fix:** Add `.take(100)` (or similar) to the server query and document the cap. Display "Showing latest 100" affordance only if the soft cap is ever hit.
2. **Proper fix:** Convert `getByUsername` to a paginated query and use `usePaginatedQuery` in the post-list UI.

Option 1 unblocks FG_233 fast. Option 2 is the correct long-term shape but more work.

## Implementation Steps

1. Decide which option to ship in this iteration.
2. If option 1: change `.collect()` → `.take(N)` in `packages/convex/convex/posts/queries.ts`; pick N (default 100); add a comment naming the cap.
3. If option 2: define the paginated query signature; update `apps/mirror/features/posts/context/*` and consumers; verify load-more interaction.
4. Verify SSR preload still works (`apps/mirror/lib/auth-server.ts` uses `preloadAuthOptionalQuery`).
5. Run `pnpm --filter=@feel-good/mirror test:e2e` for post tests and Chrome MCP at `/@test-user/posts`.

## Out of Scope

- Articles equivalent — track separately if similar pattern exists there.
