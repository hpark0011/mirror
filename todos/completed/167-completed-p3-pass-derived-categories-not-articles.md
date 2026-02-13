---
status: completed
priority: p3
issue_id: "167"
tags: [code-review, architecture, mirror]
dependencies: []
completed_date: 2026-02-13
---

# Pass Derived Categories Instead of Full Articles Array to Filter Dropdown

## Problem Statement

The full `articles` array is threaded through `ArticleToolbar` → `ArticleFilterDropdown` → `CategoryFilterContent` solely for `getUniqueCategories()`. Compute the derived data once at the top level and pass only the categories list to reduce data threading.

## Findings

- **Location:** `scrollable-article-list.tsx:131`, `article-toolbar.tsx:58`, `article-filter-dropdown.tsx:125`
- **Issue:** Unnecessary full array passing when only computed categories are needed

## Solution Applied

Computed `uniqueCategories` using `useMemo` in `ScrollableArticleList` and threaded the pre-computed categories down the component tree.

### Changes Made

1. **scrollable-article-list.tsx**
   - Added import: `getUniqueCategories` from `../utils/article-filter`
   - Added `useMemo` hook: `const uniqueCategories = useMemo(() => getUniqueCategories(articles), [articles])`
   - Pass `categories={uniqueCategories}` to ArticleToolbar instead of `articles={articles}`

2. **article-toolbar.tsx**
   - Changed prop from `articles: Article[]` to `categories: { name: string; count: number }[]`
   - Pass `categories={categories}` to ArticleFilterDropdown

3. **article-filter-dropdown.tsx**
   - Changed prop from `articles: Article[]` to `categories: { name: string; count: number }[]`
   - Pass `categories={categories}` to CategoryFilterContent

4. **category-filter-content.tsx**
   - Changed prop from `articles: Article[]` to `categories: { name: string; count: number }[]`
   - Removed `getUniqueCategories` call and local useMemo (using provided categories directly)
   - Simplified to: `categories.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))`

### Data Flow Optimization

**Before:**
```
ScrollableArticleList (articles: Article[])
  → ArticleToolbar (articles: Article[])
    → ArticleFilterDropdown (articles: Article[])
      → CategoryFilterContent (getUniqueCategories(articles))
```

**After:**
```
ScrollableArticleList
  → useMemo: uniqueCategories = getUniqueCategories(articles) [computed once]
  → ArticleToolbar (categories: derived[])
    → ArticleFilterDropdown (categories: derived[])
      → CategoryFilterContent (uses categories directly)
```

### Benefits

- **Reduced data threading:** No longer passing full articles array through 3 components
- **Better memoization:** Categories computation happens once with explicit dependency tracking
- **Cleaner data contracts:** Components receive only the data they need
- **Synergistic with #159:** Combined with prop grouping reduces total prop drilling significantly

## Acceptance Criteria

- [x] Filter dropdown receives pre-computed categories, not the full articles array
- [x] No behavior changes to end users
- [x] Categories still display correctly with correct counts
- [x] Search/filter within categories still works
- [x] Build passes successfully

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-12 | Created from PR #120 code review | |
| 2026-02-13 | Implemented + bundled with #159 | Better to do together; reduces threading + prop explosion simultaneously |

## Resources

- PR: #120
- `apps/mirror/features/articles/utils/article-filter.ts` (getUniqueCategories)
