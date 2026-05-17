---
id: FG_245
title: "Share useChatSearchParams across post list rows instead of per-row calls"
date: 2026-05-15
type: perf
status: completed
priority: p3
branch: hpark0011/post-edit-delete
verification_tier: 2
description: "useChatSearchParams() is called once in PostListItem and once in PostListItemActions — twice per owner row. For N rows that's 2N useSearchParams subscriptions and ~8N useCallback reallocations per chat-open/close. Call once at the list level and pass buildChatAwareHref down."
dependencies: []
acceptance_criteria:
  - "grep -n 'useChatSearchParams' apps/mirror/features/posts/components/list/ returns at most one usage per component file (or all calls are at or above ScrollablePostList)"
  - "Edit button still navigates to /@username/posts/:slug/edit and preserves ?chat=1 — verified by existing post-list-actions test"
  - "pnpm --filter=@feel-good/mirror test:e2e post-list-actions.authenticated.spec.ts passes"
---

# Share useChatSearchParams across post list rows instead of per-row calls

## Context

Surfaced in code review of branch `hpark0011/post-edit-delete`. `useChatSearchParams()` returns `buildChatAwareHref`. It is called at `apps/mirror/features/posts/components/list/post-list-item.tsx:77` and at `apps/mirror/features/posts/components/list/post-list-item-actions.tsx:24`. For an owner with N posts, that is 2N `useSearchParams` subscriptions and ~8N callback reallocations per searchParams change event.

## Scope

- Call `useChatSearchParams()` once at the list level (or in `PostListContext`).
- Pass `buildChatAwareHref` down as a prop or via context.

## Approach

Either thread `buildChatAwareHref` as a prop through `<PostListItem>` and `<PostListItemActions>`, or extend `PostListContextValue` with it. The context-extension approach keeps the existing prop surface stable and matches how `username` and `isOwner` already flow.

## Implementation Steps

1. Call `useChatSearchParams()` in `ScrollablePostList` (or extend `PostListContextValue` with `buildChatAwareHref`).
2. Remove the per-row calls from `PostListItem` and `PostListItemActions`; consume from the prop/context.
3. Run `pnpm build --filter=@feel-good/mirror`, `pnpm lint --filter=@feel-good/mirror`, and `pnpm --filter=@feel-good/mirror test:e2e post-list-actions.authenticated.spec.ts`.
