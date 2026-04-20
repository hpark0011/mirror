# Mirror Articles Feature — Architecture

Descriptive reference for the `apps/mirror/features/articles/` module. Load
this when you need to understand *why* the articles feature is structured the
way it is. For action-guiding rules (placement, naming, conventions), see
`.claude/rules/apps/mirror/articles.md`.

## Workspace Context Architecture

The articles feature uses a layered context pattern split by concern:

- `ArticleWorkspaceProvider` — root provider that composes all three contexts
- `ArticleToolbarContext` — owner state, sort, search, filter, categories, selected count, delete
- `ArticleListContext` — articles, pagination, username, selection, animation, empty state
- `ScrollRootContext` (from `features/content/context/`) — scroll container ref for virtualized list

Consumers import from focused contexts to avoid cross-concern re-renders.

## Component Inventory

```
components/
  article-list-toolbar.tsx              # Toolbar UI (delete, search, sort, filter, new)
  article-list-toolbar-connector.tsx    # Reads toolbar context, passes to ArticleListToolbar
  article-search-input.tsx              # Search input with open/close state
  article-sort-dropdown.tsx             # Sort order dropdown (newest/oldest/alphabetical)
  article-filter-dropdown.tsx           # Filter menu with sub-menus
  scrollable-article-list.tsx           # List wrapper with context consumers
  article-list.tsx                      # Pure UI table component (receives all props)
  article-list-item.tsx                 # Individual article table row
  article-list-loader.tsx               # Infinite scroll loader (IntersectionObserver)
  animated-article-row.tsx              # Row with animation trigger on sort
  article-detail.tsx                    # Article detail display
  article-detail-toolbar.tsx            # Toolbar for detail view (pure, props only)
  article-detail-loading.tsx            # Loading state for article detail
  delete-articles-dialog.tsx            # Confirmation dialog for deletion
  filter/
    category-filter-content.tsx         # Category filter UI (search, badges, list)
    category-filter-search.tsx          # Search input within category filter
    category-filter-badges.tsx          # Selected category badges with remove
    category-filter-list.tsx            # Category list with checkboxes
    date-filter-content.tsx             # Date preset buttons (today, week, month, year)
    status-filter-content.tsx           # Draft/published status filter
```

### Component Patterns

- **Context connectors** (`*-connector.tsx` suffix): Read context/hooks, pass values as props to a UI component. No markup of their own. Example: `ArticleListToolbarConnector` reads `useArticleToolbar()` and passes to `ArticleListToolbar`.
- **Pure presentational**: Receive all data via props. No context or hook calls. No special suffix required.
- **Dropdown/Filter content components**: Used inside `DropdownMenuSubContent` slots.
- **Container components** (e.g., `ScrollableArticleList`): Wrap presentational components and manage context consumption.

## Toolbar / Content Separation

Toolbar layout uses flexbox with two main sections:

```tsx
// Structure in ArticleListToolbar
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

**Filter content composition** — Each filter type (category, date, status) has:

1. A content component (e.g., `CategoryFilterContent`) that composes internal parts:

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

`ArticleFilterState` type in `utils/article-filter.ts`:

```typescript
{
  categories: string[];                          // Selected category names
  publishedDatePreset: DatePreset;               // null | 'today' | 'this_week' | 'this_month' | 'this_year'
  createdDatePreset: DatePreset;                 // Same, owner-only
  publishedStatus: 'draft' | 'published' | null; // Owner-only
}
```

**Filtering logic** (`filterArticles`):

- Category: AND logic (must match if set)
- Published date: AND logic with other filters
- Created date: AND logic (owner-only)
- Published status: AND logic (owner-only)
- Search happens separately in `useArticleSearch()`

**`useArticleFilter` hook**:

- Stores filter state in localStorage (`mirror.articles.filter`)
- Exports individual toggle/set functions for each filter type
- Computes `hasActiveFilters` memoized boolean

## Hooks

| Hook | Purpose | State Storage |
|------|---------|----------------|
| `useArticleSearch` | Manages search query and open state | Local state |
| `useArticleSort` | Manages sort order | LocalStorage |
| `useArticleFilter` | Manages filter state | LocalStorage |
| `useArticleSelection` | Manages multi-select checkboxes | Local state |
| `useArticlePagination` | Manages pagination with loadMore | Local state |
