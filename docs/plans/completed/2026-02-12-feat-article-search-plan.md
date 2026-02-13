---
title: "feat: Add article search with expandable input"
type: feat
date: 2026-02-12
---

# feat: Add article search with expandable input

## Overview

Add keyword search to the article list. Users can search across article titles, body text, and categories. The search input is an expandable inline component: collapsed it shows a magnifying glass icon; clicking it smoothly reveals a text input that pushes neighboring toolbar buttons to the left. Search is available to **all visitors**, not just profile owners.

## Acceptance Criteria

- [x] Clicking the search icon button reveals a text input (w-24 / 96px) with a smooth width transition
- [x] The expanding input pushes the search icon and neighboring buttons to the left
- [x] When the input opens, it auto-focuses
- [x] Typing filters articles by keyword (case-insensitive) with 300ms debounce
- [x] Search priority: title matches first, then body matches, then category matches
- [x] Clicking the close (✕) button collapses the input, clears the query, and restores the full list
- [x] Search works for all visitors (not just profile owners)
- [x] Pagination resets when search query changes
- [x] Empty search results show a "No articles found" message
- [x] Pressing Escape closes the search input
- [x] Opening search clears any active selection (owner)
- [x] Closing search cancels any pending debounce timer
- [x] Sort dropdown is visible to all visitors (alongside search)
- [x] Focus returns to search button when input is closed

## Architecture

```
                          ┌─────────────────────────┐
                          │ scrollable-article-list  │
                          │                          │
                          │  useArticleSearch(articles, query)
                          │       │                  │
                          │       ▼                  │
                          │  filteredArticles         │
                          │       │                  │
                          │       ▼                  │
                          │  useArticleList(          │
                          │    filteredArticles,      │
                          │    sortOrder)             │
                          │       │                  │
                          │       ▼                  │
                          │  paginatedArticles       │
                          └─────────────────────────┘

Data flow:
  articles → search filter → sort → paginate → render
```

## Implementation

### Phase 1: Search hook — `features/articles/hooks/use-article-search.ts` (new)

Custom hook encapsulating search state and filtering logic.

```typescript
type UseArticleSearchReturn = {
  filteredArticles: Article[];
  query: string;
  setQuery: (q: string) => void;
  isOpen: boolean;
  open: () => void;
  close: () => void;
};

function useArticleSearch(articles: Article[]): UseArticleSearchReturn {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  // 300ms debounce
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Filter + sort by match priority (title > body > category)
  const filteredArticles = useMemo(() => {
    if (!debouncedQuery.trim()) return articles;

    const q = debouncedQuery.toLowerCase();

    return articles
      .filter(a =>
        a.title.toLowerCase().includes(q) ||
        a.body.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q)
      )
      .sort((a, b) => {
        const scoreArticle = (article: Article) => {
          if (article.title.toLowerCase().includes(q)) return 0;
          if (article.body.toLowerCase().includes(q)) return 1;
          return 2;
        };
        return scoreArticle(a) - scoreArticle(b);
      });
  }, [articles, debouncedQuery]);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => {
    setIsOpen(false);
    setQuery("");
    setDebouncedQuery(""); // Cancel pending debounce effect immediately
  }, []);

  return { filteredArticles, query, setQuery, isOpen, open, close };
}
```

**Key decisions:**
- Debounce is a simple `useEffect` + `setTimeout` — no need for a full `useDebouncedCallback` hook for this single use case (YAGNI)
- Priority scoring: title match = 0, body match = 1, category match = 2 — lower score sorts first
- `close()` clears both `query` and `debouncedQuery` immediately — cancels any pending debounce and restores full list

### Phase 2: Search input UI — `features/articles/components/article-search-input.tsx` (new)

Expandable inline search input with smooth transition.

```typescript
type ArticleSearchInputProps = {
  query: string;
  onQueryChange: (q: string) => void;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
};
```

**UI states:**

| State | Rendered |
|-------|----------|
| Collapsed | `[🔍]` icon button |
| Expanded | `[🔍] [____input____] [✕]` |

**Animation approach:**
- The input wrapper uses `w-0 → w-24` with `transition-all duration-200 ease-out`
- `overflow-hidden` on the wrapper clips the input during transition
- `opacity-0 → opacity-100` for a fade-in effect
- The outer container is `flex` — as the input wrapper grows, it naturally pushes sibling buttons left (since the toolbar is `justify-end`)

**Behavior:**
- On open: auto-focus the input via `useRef` + `useEffect`
- On close: return focus to the search icon button via ref
- On Escape keydown: call `onClose()`
- On close button click: call `onClose()`
- Input is `type="text"` with `placeholder="Search..."` and `aria-label="Search articles"`
- Search toggle button uses `aria-expanded={isOpen}`

### Phase 3: Toolbar restructure — `features/articles/components/article-toolbar.tsx` (modify)

Make the toolbar render for all visitors. Owner-only items (delete, New) are conditionally hidden.

**Props change:**
```typescript
type ArticleToolbarProps = {
  isOwner: boolean;        // NEW — controls delete/New visibility
  selectedCount: number;
  onDelete: () => void;
  sortOrder: SortOrder;
  onSortChange: (order: SortOrder) => void;
  // Search props
  searchQuery: string;     // NEW
  onSearchQueryChange: (q: string) => void;  // NEW
  isSearchOpen: boolean;   // NEW
  onSearchOpen: () => void;   // NEW
  onSearchClose: () => void;  // NEW
};
```

**Changes:**
- Replace the search button stub (lines 58-69) with `<ArticleSearchInput>`
- Wrap delete button + selection count in `{isOwner && ...}`
- Wrap "New" button in `{isOwner && ...}`
- Sort and Filter buttons remain visible to everyone

### Phase 4: Wire into orchestrator — `features/articles/components/scrollable-article-list.tsx` (modify)

```diff
  const [articles, setArticles] = useState(initialArticles);
+ const search = useArticleSearch(articles);
  const { sortOrder, setSortOrder } = useArticleSort();
  const { articles: paginatedArticles, hasMore, loadMore } = useArticleList(
-   articles,
+   search.filteredArticles,
    sortOrder,
  );
```

**Key changes:**
- Import and use `useArticleSearch`
- Pass `search.filteredArticles` (instead of raw `articles`) to `useArticleList`
- Always render `<ArticleToolbar>` (remove `{isOwner && ...}` guard)
- Pass `isOwner` prop to toolbar
- Pass all search state props to toolbar
- Clear selection when search opens: `search.isOpen` triggers `selection.clear()`
- Show "No articles match your search" when `search.filteredArticles.length === 0 && search.query`

### Phase 5: Pagination reset — `features/articles/hooks/use-article-list.ts` (modify)

Reset page to 1 when the input articles change (due to search filtering).

```typescript
// Add ref to track previous articles identity
const prevArticlesRef = useRef(allArticles);

useEffect(() => {
  if (prevArticlesRef.current !== allArticles) {
    setPage(1);
    prevArticlesRef.current = allArticles;
  }
}, [allArticles]);
```

This ensures that when the user searches and the filtered list changes, pagination resets so they see results from the beginning.

## Edge Cases

| Case | Behavior |
|------|----------|
| Empty query (whitespace only) | Show all articles (no filtering) |
| No matching articles | Show "No articles found" message |
| Query matches in multiple fields | Prioritize: title > body > category |
| Very fast typing | Debounce (300ms) prevents excessive filtering |
| Close search while typing | Clear query, restore full list |
| Search + sort interaction | Search filters first, then sort applies to filtered results |
| Search + pagination | Page resets to 1 on query change |
| Search + delete | Deleting articles updates the source list; search re-filters automatically |
| Escape key | Closes search input and clears query |
| Search + selection | Opening search clears the selection to prevent deleting hidden articles |
| Close search while debounce pending | `close()` sets `debouncedQuery=""` immediately, no stale filter fires |
| Body-only match not visible in list | User sees the article row (title/category/date) even if match was in body |

## Accessibility

- Search button has `aria-label="Search articles"`
- Close button has `aria-label="Close search"`
- Input has `aria-label="Search articles"` and `role="searchbox"`
- Focus management: auto-focus on open, return focus to search button on close
- Escape key closes search

## File Summary

| File | Action | Purpose |
|------|--------|---------|
| `hooks/use-article-search.ts` | **New** | Search state + debounced filtering + priority sorting |
| `components/article-search-input.tsx` | **New** | Expandable search input UI with transition animation |
| `components/article-toolbar.tsx` | **Modify** | Replace stub; add `isOwner` prop; pass search props |
| `components/scrollable-article-list.tsx` | **Modify** | Integrate search hook; always render toolbar |
| `hooks/use-article-list.ts` | **Modify** | Reset page when filtered articles change |
| `index.ts` | **Modify** | Export search hook if needed externally |

## References

- Search button stub: `apps/mirror/features/articles/components/article-toolbar.tsx:58-69`
- Orchestrator: `apps/mirror/features/articles/components/scrollable-article-list.tsx`
- Pagination hook: `apps/mirror/features/articles/hooks/use-article-list.ts`
- Article type: `apps/mirror/features/articles/lib/mock-articles.ts:1-9`
- Debounce reference: `apps/greyboard/hooks/use-debounced-callback.ts`
- Sort plan (same files): `docs/plans/2026-02-12-feat-article-sort-by-date-plan.md`
- Input primitive: `packages/ui/src/primitives/input.tsx`
