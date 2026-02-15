---
date: 2026-02-15
topic: article-list-back-nav-perf
---

# Article List Back-Navigation Performance

## What We're Building

Fix the noticeable pause when navigating back from article detail to the article list. The root cause is `ArticleWorkspaceProvider` living in `page.tsx`, so it unmounts on forward navigation and re-mounts from scratch on back navigation — reinitializing 5 hooks, rebuilding the searchable articles array, and mounting 30 list items fresh.

## Why This Approach

**Chosen: Lift `ArticleWorkspaceProvider` into `ProfileShell`** (layout-level client component).

Moving the provider above the route swap boundary prevents the unmount/remount cycle entirely. All workspace state (search, filter, sort, pagination, selection) survives list <-> detail navigation naturally.

**Rejected: Module-level state cache.** Only a partial mitigation — the route still remounts, server/page work still re-runs, and 30 list rows still mount fresh. Adds cache invalidation risk without solving the root cause.

## Key Decisions

- **Provider placement**: `ProfileShell` (not `layout.tsx` directly) — ProfileShell is the persistent client component that already owns scroll management, `isOwner` context, and responsive layout
- **Articles prop**: `layout.tsx` server component computes the filtered articles array and passes it to `ProfileShell`, which passes it to `ArticleWorkspaceProvider`
- **Detail page**: Provider wraps the detail route too — harmless since nothing on the detail page consumes article list context
- **Secondary optimizations deferred**: Auth deduplication and search plaintext precomputation can be evaluated after measuring the impact of this fix

## Open Questions

- How should `page.tsx` change — does it become a thin shell that just renders toolbar + list, or does it disappear entirely with those components inlined in ProfileShell?
- When real data replaces mocks, the layout will own article fetching — acceptable since articles are the primary content of the profile route

## Next Steps

→ `/workflows:plan` for implementation details
