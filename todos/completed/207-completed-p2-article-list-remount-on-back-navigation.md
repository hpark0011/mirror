---
status: completed
priority: p2
issue_id: "207"
tags: [performance, mirror, navigation, articles, ux]
dependencies: []
---

# Article list remounts on back navigation causing perceived slowness

## Problem Statement

Navigating from article detail back to the article list feels noticeably slower than the forward navigation (list → detail). The list page shouldn't need to reload anything new, yet the entire article list re-initializes from scratch on every back navigation.

## Root Cause

The `ArticleWorkspaceProvider` lives in `page.tsx` (not the layout), so it **unmounts** when navigating to the detail page and **re-mounts from scratch** when navigating back. This triggers a cascade of re-initialization work:

1. **`useArticleSearch` recomputes `getPlainText()` on all 30 articles** — the `useMemo` in `use-article-search.ts` (line 31) runs on every mount, calling `getPlainText()` per article. The `WeakMap` cache in `get-plain-text.ts` (line 8) is keyed on `article.body` object identity — since `MOCK_ARTICLES` is a module-level constant, cache hits are likely, but the `useMemo` still builds the `searchableArticles` array with `.map()` and `.toLowerCase()` calls on every mount.
2. **All 5 hooks in `ArticleWorkspaceProvider`** re-initialize (search, sort, filter, pagination, selection)
3. **`useArticleFilter` initializes with default state**, then hydrates from `localStorage` asynchronously via `useEffect` in `use-local-storage.ts` (line 16) — this causes a second render pass when the stored filter state arrives
4. **All 30 `ArticleListItem` components mount fresh** — `React.memo` doesn't help on initial mount
5. **Back transition has a fixed 300ms animation** (`slide-to-right` in `globals.css` line 51) — this is a designed-in visual cost that contributes to perceived slowness regardless of render performance

### Why forward (list → detail) feels fast

The detail page is trivially cheap: one synchronous article lookup, one `ArticleDetailView`, and `RichTextViewer` with `immediatelyRender: false` (deferred Tiptap rendering in `rich-text-viewer.tsx` line 24).

### Why back (detail → list) feels slow

The entire article workspace re-initializes. No state is preserved — search query, filter state, pagination page all reset. Scroll position is manually restored via `useProfileNavigationEffects`, but the component tree rebuilds from scratch. The 300ms slide animation overlaps with this rebuild, and if the list isn't ready before the animation completes, the user sees a partially-rendered or blank state.

### Note on `isAuthenticated()`

Both `layout.tsx` (line 22) and `page.tsx` (line 16) call `isAuthenticated()`, but the underlying token fetch is wrapped in `React.cache`, and shared layouts are preserved across sibling route transitions in Next.js App Router. This is **not** a significant contributor to back-navigation slowness.

## Affected Files

| File | Role in the problem |
|------|---------------------|
| `apps/mirror/app/[username]/page.tsx` | Server component that re-renders, creating a fresh articles array |
| `apps/mirror/features/articles/context/article-workspace-context.tsx` | Client provider that re-mounts with all 5 hooks |
| `apps/mirror/features/articles/hooks/use-article-search.ts` | Rebuilds `searchableArticles` array on mount (line 31-39) |
| `packages/features/editor/lib/get-plain-text.ts` | WeakMap cache keyed on `article.body` identity — likely hits for static mock data |
| `apps/mirror/styles/globals.css` | 300ms `slide-to-right` animation on back transition (line 51) |

## Proposed Solutions

### Option A: Precompute search plaintext in article model (Quick win)

Add a `searchPlainText` field to each article in `mock-articles.ts` (or compute it once at module level). This eliminates `getPlainText()` and `.toLowerCase()` calls during `useArticleSearch` mount entirely.

- **Effort:** Small
- **Risk:** Low
- **Impact:** Removes the most expensive per-article computation on mount

### Option B: Move `ArticleWorkspaceProvider` to the layout (Structural fix)

Move the provider from `page.tsx` into `layout.tsx` (or `ProfileShell`). This preserves all list state (search, filter, sort, pagination, selection) across list <-> detail navigation. The provider would persist because layouts survive sibling route changes in Next.js App Router.

- **Effort:** Medium — requires rethinking how articles are passed from server to client
- **Risk:** Medium — layout now owns article state; need to handle article refresh scenarios
- **Impact:** Eliminates the full re-mount entirely; list state survives navigation

### Recommended approach

Start with Option A (quick win), then evaluate whether Option B is needed based on perceived improvement.

## Acceptance Criteria

- [ ] Back navigation (detail → list) has no perceptible delay beyond the 300ms transition animation
- [ ] `searchableArticles` array is not recomputed from scratch on every back navigation
- [ ] Article list state (scroll position) is correctly restored on back navigation
- [ ] No regressions in search, filter, sort, or pagination behavior

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-15 | Created from performance investigation | Provider placement in page vs layout has major impact on navigation perf; WeakMap caches are keyed on object identity, not structural equality; `useLocalStorage` hydrates async via useEffect, not synchronously; `React.cache` deduplicates server-side auth calls within a request |
| 2026-02-15 | Revised after review | Corrected article count (30, not 32), localStorage read timing (async useEffect, not sync), WeakMap key precision (article.body identity, not array ref), removed overstated "double auth" claim, added 300ms animation as baseline contributor |
