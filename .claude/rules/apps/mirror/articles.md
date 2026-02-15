---
paths:
  - "apps/mirror/features/articles/**"
---

# Mirror Articles Feature Rules

## Workspace Context Architecture

The articles feature uses a layered context pattern split by concern:

- `ArticleWorkspaceProvider` — root provider that composes all three contexts
- `ArticleToolbarContext` — owner state, sort, search, filter, categories, selected count, delete
- `ArticleListContext` — articles, pagination, username, selection, animation, empty state
- `ScrollRootContext` — scroll container ref for virtualized list

Consumers import from focused contexts to avoid cross-concern re-renders.

## Component Organization

```
components/
  article-toolbar.tsx              # Toolbar UI (delete, search, sort, filter, new)
  article-toolbar-view.tsx         # View wrapper that reads toolbar context
  article-search-input.tsx         # Search input with open/close state
  article-sort-dropdown.tsx        # Sort order dropdown (newest/oldest/alphabetical)
  article-filter-dropdown.tsx      # Filter menu with sub-menus
  scrollable-article-list.tsx      # List wrapper with context consumers
  article-list-item.tsx            # Individual article table row
  article-list-loader.tsx          # Infinite scroll loader (IntersectionObserver)
  animated-article-row.tsx         # Row with animation trigger on sort
  filter/
    category-filter-content.tsx    # Category filter UI (search, badges, list)
    category-filter-search.tsx     # Search input within category filter
    category-filter-badges.tsx     # Selected category badges with remove
    category-filter-list.tsx       # Category list with checkboxes
    date-filter-content.tsx        # Date preset buttons (today, week, month, year)
    status-filter-content.tsx      # Draft/published status filter

views/
  article-list-view.tsx            # Pure UI table component (receives all props)
  article-detail-view.tsx          # Article detail display
  article-detail-toolbar-view.tsx  # Toolbar for detail view
  delete-articles-dialog.tsx       # Confirmation dialog for deletion
```

### Component Patterns

- **Views** are pure UI components that receive all state as props
- **_View Components** (e.g., `ArticleToolbarView`) read context and pass to underlying components
- **Dropdown/Filter Content Components** are used inside DropdownMenuSubContent slots
- **Container Components** (e.g., `ScrollableArticleList`) wrap views and manage context consumption

## Toolbar / Content Separation

Toolbar layout uses flexbox with two main sections:

```tsx
// Structure in ArticleToolbar
<div className="flex items-center justify-end w-full gap-3">
  {/* Left: Selection counter (if isOwner && hasSelection) */}
  {isOwner && hasSelection && (
    <span>{selectedCount} selected</span>
  )}

  {/* Right: Action buttons */}
  <div className="flex items-center">
    <AlertDialog> {/* Delete */}
    <ArticleSearchInput /> {/* Search */}
    <ArticleSortDropdown /> {/* Sort */}
    <ArticleFilterDropdown /> {/* Filter */}
    {isOwner && <Button>New</Button>}
  </div>
</div>
```

**Key behaviors:**
- Delete button: disabled if no selection
- Search input: toggles open state, clears selection when opened
- Sort dropdown: triggers animation when changed, clears selection
- Filter dropdown: clears selection when filters change
- New button: only shown to owner

## Filter Pattern

Filter uses a **DropdownMenu → DropdownMenuSub → DropdownMenuSubContent** composition:

```tsx
<DropdownMenu>
  <DropdownMenuTrigger> {/* Filter icon button */}
  <DropdownMenuContent align="end">
    <DropdownMenuSub>
      <DropdownMenuSubTrigger> {/* "Category" label */}
      <DropdownMenuSubContent className="max-w-[240px]">
        <CategoryFilterContent /> {/* Filter sub-component */}
      </DropdownMenuSubContent>
    </DropdownMenuSub>

    {/* More subs for date filters, status (owner-only) */}

    {hasActiveFilters && (
      <DropdownMenuItem onSelect={onClearAll}>
        Clear all filters
      </DropdownMenuItem>
    )}
  </DropdownMenuContent>
</DropdownMenu>
```

**Filter Content Composition** — Each filter type (category, date, status) has:

1. A **Content Component** (e.g., `CategoryFilterContent`) that composes internal parts:
   ```tsx
   <CategoryFilterContent>
     <CategoryFilterSearch />
     <DropdownMenuSeparator />
     <CategoryFilterBadges /> {/* Selected items */}
     <DropdownMenuSeparator />
     <CategoryFilterList /> {/* Available items */}
   </CategoryFilterContent>
   ```

2. Props flow: Dropdown → Content → Sub-components (search, badges, list)

3. State: Managed in hook (`useArticleFilter`) and passed via dropdown props

## Filter State Architecture

**ArticleFilterState** type in `utils/article-filter.ts`:
```typescript
{
  categories: string[];              // Selected category names
  publishedDatePreset: DatePreset;   // null | 'today' | 'this_week' | 'this_month' | 'this_year'
  createdDatePreset: DatePreset;     // Same, owner-only
  publishedStatus: 'draft' | 'published' | null; // Owner-only
}
```

**Filtering Logic** (`filterArticles`):
- Category: AND logic (must match if set)
- Published date: AND logic with other filters
- Created date: AND logic (owner-only)
- Published status: AND logic (owner-only)
- Search happens separately in `useArticleSearch()`

**useArticleFilter Hook**:
- Stores filter state in localStorage (`mirror.articles.filter`)
- Exports: individual toggle/set functions for each filter type
- Computes `hasActiveFilters` memoized boolean

## Hooks

| Hook | Purpose | State Storage |
|------|---------|----------------|
| `useArticleSearch` | Manages search query and open state | Local state |
| `useArticleSort` | Manages sort order | LocalStorage |
| `useArticleFilter` | Manages filter state | LocalStorage |
| `useArticleSelection` | Manages multi-select checkboxes | Local state |
| `useArticlePagination` | Manages pagination with loadMore | Local state |

## Key Conventions

1. **Context Usage**: Always use context consumer hooks (`useArticleToolbar`, `useArticleList`) rather than accessing context directly
2. **Props vs Context**: Views accept props, containers/wrappers read context and pass as props
3. **Memoization**: `ArticleWorkspaceProvider` memoizes toolbar and list context values to prevent unnecessary re-renders
4. **Animation State**: `shouldAnimate` triggers briefly on sort change via timer (1000ms timeout)
5. **Selection Clearing**: Auto-cleared when search opens or filters change (via useEffect in workspace provider)
6. **Scroll Root**: Optional parameter passed to `ArticleListLoader` for IntersectionObserver root element
7. **Empty States**: Computed from `hasNoArticles`, active search/filters, with contextual messages
8. **Owner-Only Features**: Created date filter, status filter, delete button, new button all check `isOwner`
