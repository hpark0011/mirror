---
id: FG_259
title: "Post list rows do not re-render on every chat panel toggle"
date: 2026-05-18
type: perf
status: to-do
priority: p2
description: "buildChatAwareHref carries the Next searchParams object in its deps and was placed on the PostListContext memo, so every chat open, close, or conversation change gives it a new identity and re-renders every post row."
dependencies: ["FG_251"]
acceptance_criteria:
  - "apps/mirror/features/posts/context/post-list-context.tsx no longer exposes buildChatAwareHref on the context value (or it is stabilized independent of the searchParams object identity)"
  - "PostListItem obtains buildChatAwareHref without going through usePostList()"
  - "`pnpm --filter=@feel-good/mirror build` passes"
  - "`pnpm --filter=@feel-good/mirror exec playwright test e2e/post-list-actions.authenticated.spec.ts` passes (chat-aware hrefs still correct, ?chat=1 preserved); if the e2e environment is unavailable, the build plus code reading must show hrefs unchanged"
---

# Post list rows do not re-render on every chat panel toggle

## Context

This branch added `buildChatAwareHref` (from `useChatSearchParams()`) into the `PostListContext` value and its `useMemo` dep array (`apps/mirror/features/posts/context/post-workspace-context.tsx`). `useChatSearchParams`'s callback depends on Next's `useSearchParams()` object, which gets a fresh identity on every search-param change — `?chat=1` toggling, `?conversation=…`, `?chatMode=…`. Each change yields a new `buildChatAwareHref`, invalidating the whole context value and re-rendering every `usePostList()` consumer (every `PostListItem`, every `PostListItemActions`).

Found in code review (performance reviewer, confidence 0.80). With 50–100 rows this is a 50–100 component re-render wave on every chat interaction — new cost this branch introduced.

## Scope

- Remove `buildChatAwareHref` from the post-list context value (or stabilize it on primitive inputs).
- Have the leaf components that need it call `useChatSearchParams()` directly.

## Approach

Preferred: drop `buildChatAwareHref` from `PostListContextValue` and the provider memo; call `useChatSearchParams().buildChatAwareHref` in `PostListItem` (and in `PostListItemActions` only if it still builds an href there after FG_251). These leaves already re-render on their own props, so per-row hook usage is no worse and the context stops thrashing. Alternative: keep it in context but memo-stabilize on the primitive inputs (`chatMode`, `isChatOpen`, conversation-id string) instead of the `searchParams` object.

## Implementation Steps

1. (FG_251 already landed) read `post-workspace-context.tsx`, `post-list-context.tsx`, `post-list-item.tsx`, `post-list-item-actions.tsx`, and `useChatSearchParams`. NOTE: FG_251 rewrote the Edit affordance in `post-list-item-actions.tsx` — read its current state first.
2. Remove `buildChatAwareHref` from the context type + provider memo (or stabilize the callback).
3. Call `useChatSearchParams()` directly in the leaf component(s) that still need it.
4. Run `pnpm --filter=@feel-good/mirror build` and the e2e post-list-actions spec.

## Constraints

- Depends on FG_251 (already completed): it rewrote `post-list-item-actions.tsx`. Read the current file before editing — do not reintroduce a removed Edit `<Link>`.
