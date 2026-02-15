---
title: "refactor: Split ArticleWorkspaceContext into Toolbar + List Contexts"
type: refactor
date: 2026-02-13
---

# Split ArticleWorkspaceContext into Toolbar + List Contexts

## Overview

The monolithic `ArticleWorkspaceContext` holds 21 properties and both consumers (`ArticleToolbarView`, `ScrollableArticleList`) subscribe to the full context. Any state change — even a single checkbox toggle — invalidates the entire `useMemo` and forces both subtrees to re-render. Split into two focused contexts so each consumer only re-renders for changes it cares about.

## Problem Statement

The context value (line 166 of `article-workspace-context.tsx`) combines toolbar state, list state, and empty state into one object with 28 `useMemo` dependencies. The two consumers destructure different subsets:

- **ArticleToolbarView** reads 8 toolbar props (sort, search, filter, categories, selectedCount, onDelete)
- **ScrollableArticleList** reads 11 list props + 3 empty state props

When a user types in the search box, `search.query` changes on every keystroke. Because `search` is in the monolithic `useMemo`, the list re-renders on every keystroke — even though the list only needs `filteredArticles` (which updates after the 300ms debounce). Similarly, `shouldAnimate` (a list concern) re-renders the toolbar unnecessarily.

## Proposed Solution

Split into `ArticleToolbarContext` and `ArticleListContext`. Keep one provider component (`ArticleWorkspaceProvider`) that calls all 5 hooks and produces two context values via separate `useMemo` calls. Rename the existing `useArticleList` hook to `useArticlePagination` to avoid naming collision with the new context consumer hook.

### What stays unchanged

- `profile-context.tsx` — tiny stable boolean
- `scroll-root-context.tsx` — single DOM ref
- `workspace-toolbar-slot.tsx` — portal target wiring
- `use-article-list.ts` line 19 state-during-render — React-recommended "store previous props" pattern, correct as-is
- `articles/index.ts` barrel — exports components not hooks, no changes needed
- Local UI state like `isDeleteOpen` in `article-toolbar.tsx`

### Future Phase 2 (conditional, not in this plan)

If list interactions still feel heavy after Phase 1, migrate selection to a Zustand store with per-row selectors. Only pursue if profiling shows >16ms render time on selection toggle with 100+ articles.

## Performance Wins

| Interaction | Before | After |
|---|---|---|
| Search keystroke | Both toolbar + list re-render | Only toolbar re-renders; list waits for debounced `filteredArticles` |
| Sort animation tick | Both re-render | Only list re-renders (`shouldAnimate` not in toolbar context) |
| Filter panel toggle | Both re-render | Only toolbar re-renders until filter state actually changes results |

Selection toggles still re-render both (toolbar needs `selectedCount`) — this is inherent coupling and acceptable since the toolbar re-render is cheap (no array iteration).

## Technical Approach

### Context Shape

**ArticleToolbarContext (8 props):**

```typescript
type ArticleToolbarContextValue = {
  isOwner: boolean;
  sortOrder: SortOrder;
  onSortChange: (order: SortOrder) => void;
  search: UseArticleSearchReturn;
  filter: UseArticleFilterReturn;
  categories: { name: string; count: number }[];
  selectedCount: number;
  onDelete: () => void;
};
```

**ArticleListContext (13 props):**

```typescript
type ArticleListContextValue = {
  articles: Article[];
  hasMore: boolean;
  onLoadMore: () => void;
  username: string;
  isOwner: boolean;
  isAllSelected: boolean;
  isIndeterminate: boolean;
  onToggleAll: () => void;
  isSelected: (slug: string) => boolean;
  onToggle: (slug: string) => void;
  shouldAnimate: boolean;
  hasNoArticles: boolean;
  showEmpty: boolean;
  emptyMessage: string;
};
```

`isOwner` appears in both — intentional duplication of a stable primitive boolean that rarely changes (set once on page load from `ProfileContext`).

### Provider composition

Both contexts derive from the same hook pipeline. A single `ArticleWorkspaceProvider` component calls all 5 hooks exactly as today, then produces two values:

```tsx
<ArticleToolbarContext.Provider value={toolbarValue}>
  <ArticleListContext.Provider value={listValue}>
    {children}
  </ArticleListContext.Provider>
</ArticleToolbarContext.Provider>
```

No "which wraps which" question — order doesn't matter since neither provider consumes the other.

### useMemo dependency separation

```typescript
// Toolbar — re-renders on: sort, search keystroke, filter change, selection count change, delete
const toolbarValue = useMemo(() => ({...}), [
  isOwner, sortOrder, handleSortChange, search, filter,
  uniqueCategories, selectedSlugs.size, handleDelete,
]);

// List — re-renders on: articles change, pagination, selection toggle, animation
const listValue = useMemo(() => ({...}), [
  paginatedArticles, hasMore, loadMore, username, isOwner,
  selection.isAllSelected, selection.isIndeterminate, selection.toggleAll,
  selection.isSelected, selection.toggle, shouldAnimate,
  hasNoArticles, showEmpty, emptyMessage,
]);
```

## Acceptance Criteria

- [ ] `ArticleToolbarView` consumes only `useArticleToolbar()` — does not re-render on list-only changes
- [ ] `ScrollableArticleList` consumes only `useArticleList()` — does not re-render on toolbar-only changes (search keystrokes)
- [ ] Selection, sorting, filtering, pagination, delete, empty states all work identically to current behavior
- [ ] `pnpm build --filter=@feel-good/mirror` passes
- [ ] `pnpm lint --filter=@feel-good/mirror` passes
- [ ] No barrel export changes needed (`ArticleWorkspaceProvider` name unchanged)

## Implementation Plan

### Step 1: Create new context definitions (2 new files)

**`features/articles/context/article-toolbar-context.tsx`**

- Export `ArticleToolbarContextValue` type
- Export `ArticleToolbarContext` (createContext)
- Export `useArticleToolbar()` consumer hook with error boundary

**`features/articles/context/article-list-context.tsx`**

- Export `ArticleListContextValue` type
- Export `ArticleListContext` (createContext)
- Export `useArticleList()` consumer hook with error boundary

### Step 2: Rename hook to avoid naming collision (1 file rename)

**`hooks/use-article-list.ts` → `hooks/use-article-pagination.ts`**

- Rename exported function `useArticleList` → `useArticlePagination`
- Only one import site: `article-workspace-context.tsx`

### Step 3: Refactor the provider (1 file modify)

**`context/article-workspace-context.tsx`**

- Remove: `ArticleWorkspaceContextValue` type, `ArticleWorkspaceContext`, `useArticleWorkspace` export
- Import: `ArticleToolbarContext` from new file, `ArticleListContext` from new file
- Import: `useArticlePagination` (renamed)
- Replace single `useMemo` (line 166-218) with two separate `useMemo` calls
- Replace single `<ArticleWorkspaceContext.Provider>` with nested providers
- All hook composition pipeline stays identical (lines 68-164 unchanged)

### Step 4: Update consumers (2 files modify)

**`components/article-toolbar-view.tsx`**

- Change import: `useArticleWorkspace` → `useArticleToolbar` from `../context/article-toolbar-context`
- Change call: `const ctx = useArticleToolbar()`
- Props passed to `<ArticleToolbar>` unchanged

**`components/scrollable-article-list.tsx`**

- Change import: `useArticleWorkspace` → `useArticleList` from `../context/article-list-context`
- Change call: `const ctx = useArticleList()`
- Props passed to `<ArticleListView>` and empty state checks unchanged

## File Summary

| File | Action |
|---|---|
| `features/articles/context/article-toolbar-context.tsx` | CREATE |
| `features/articles/context/article-list-context.tsx` | CREATE |
| `features/articles/hooks/use-article-list.ts` → `use-article-pagination.ts` | RENAME + modify export |
| `features/articles/context/article-workspace-context.tsx` | MODIFY (remove monolith, produce two values) |
| `features/articles/components/article-toolbar-view.tsx` | MODIFY (swap hook import) |
| `features/articles/components/scrollable-article-list.tsx` | MODIFY (swap hook import) |
| `features/articles/index.ts` | NO CHANGE |

All changes are atomic — ship together in one commit.

## Verification

1. `pnpm build --filter=@feel-good/mirror` — TypeScript passes
2. `pnpm lint --filter=@feel-good/mirror` — no lint errors
3. Manual: navigate to `/@username` profile page, verify:
   - Toolbar renders with sort, search, filter controls
   - Article list renders with pagination (scroll to load more)
   - Selection checkboxes work (toggle individual, toggle all, indeterminate state)
   - Search filters articles after debounce
   - Sort change triggers list animation
   - Delete selected articles works
   - Empty state messages display correctly for search/filter with no results

## References

- `apps/mirror/features/articles/context/article-workspace-context.tsx` — core file to refactor
- `apps/mirror/features/articles/components/article-toolbar-view.tsx` — toolbar consumer
- `apps/mirror/features/articles/components/scrollable-article-list.tsx` — list consumer
- `apps/mirror/features/articles/hooks/use-article-selection.ts` — selection hook (Phase 2 Zustand candidate)
- `apps/mirror/features/articles/hooks/use-article-list.ts` — pagination hook to rename
- `.claude/rules/state-management.md` — state management conventions
