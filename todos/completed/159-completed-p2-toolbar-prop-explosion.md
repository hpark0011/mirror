---
status: completed
priority: p2
issue_id: "159"
tags: [code-review, react, architecture, mirror]
dependencies: []
completed_date: 2026-02-13
---

# ArticleToolbar 19-Prop Explosion

## Problem Statement

`ArticleToolbar` accepts 19 props but only uses 3 directly (`isOwner`, `selectedCount`, `onDelete`). The remaining 16 are pure pass-through to child components. This is prop drilling that makes the component harder to maintain and extend.

## Findings

- **Source:** kieran-typescript-reviewer, architecture-strategist, performance-oracle, pattern-recognition-specialist, code-simplicity-reviewer
- **Location:** `apps/mirror/features/articles/components/article-toolbar.tsx:25-45`
- **Evidence:** 10 filter-related props forwarded directly to ArticleFilterDropdown, 5 search props to ArticleSearchInput, 2 sort props to ArticleSortDropdown.

## Solution Applied

Implemented Option A: Grouped filter and search props into objects.

### Changes Made

1. **useArticleFilterReturn** (exported type)
   - ArticleToolbar now accepts `filter: UseArticleFilterReturn` instead of 10 individual filter props
   - Internal destructuring: `filter.toggleCategory`, `filter.filterState`, etc.

2. **UseArticleSearchReturn** (exported type)
   - ArticleToolbar now accepts `search: UseArticleSearchReturn` instead of 5 individual search props
   - Internal destructuring: `search.query`, `search.setQuery`, `search.open`, etc.

3. **categories prop**
   - Part of #167 fix: receives pre-computed categories instead of needing to pass full articles array
   - Type: `{ name: string; count: number }[]`

### Prop Reduction

**Before:** 19 props
- isOwner, selectedCount, onDelete, sortOrder, onSortChange
- searchQuery, onSearchQueryChange, isSearchOpen, onSearchOpen, onSearchClose
- articles, filterState, hasActiveFilters, onToggleCategory, onSetPublishedDatePreset, onSetCreatedDatePreset, onSetPublishedStatus, onClearAll, onClearCategories

**After:** 8 props
- isOwner, selectedCount, onDelete, sortOrder, onSortChange
- search, categories, filter

## Acceptance Criteria

- [x] ArticleToolbar has fewer than 12 explicit props (now has 8)
- [x] No behavior changes to end users
- [x] Filter, search, and sort still function correctly
- [x] Build passes successfully

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-12 | Created from PR #120 code review | 5/6 agents flagged |
| 2026-02-13 | Implemented Option A + completed with #167 | Grouped props reduced drilling significantly |

## Resources

- PR: #120
- `apps/mirror/features/articles/components/article-toolbar.tsx`
- `apps/mirror/features/articles/hooks/use-article-filter.ts` (UseArticleFilterReturn type)
- `apps/mirror/features/articles/hooks/use-article-search.ts` (UseArticleSearchReturn type)
