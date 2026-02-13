---
title: "feat: Add article list filter"
type: feat
date: 2026-02-12
---

# Add Article List Filter

## Overview

Add a multi-dimension filter to the Mirror article list that lets users filter by **category**, **published date**, **created date**, and **published state**. The filter uses a DropdownMenu with sub-menus pattern, persists selections in localStorage, and composes with the existing search and sort pipeline. The **created date** and **published state** sub-menus are only visible to the profile owner.

## Problem Statement

The article list currently supports search (text matching) and sort (newest/oldest) but has no way to filter by structured dimensions like category, date range, or publish status. The filter button in the toolbar is a placeholder stub (`article-toolbar.tsx:96-107`). Users with many articles need a way to narrow the view by these dimensions.

## Proposed Solution

A **DropdownMenu with 4 sub-menus** (Category, Published date, Created date, Status), wired into the existing data pipeline between search and sort. Filter state persists in localStorage. The **Created date** and **Status** sub-menus are only visible to profile owners.

### Architecture

**Updated data pipeline:**

```
articles → search filter → ARTICLE FILTER → sort → paginate → render
```

**Component structure:**

```
ArticleFilterDropdown (main container)
├── DropdownMenuTrigger → filter icon button with active indicator
├── DropdownMenuContent
│   ├── DropdownMenuSub (Category)
│   │   ├── DropdownMenuSubTrigger → "Category" label + selected count badge
│   │   └── DropdownMenuSubContent
│   │       ├── CategoryFilterSearch (search input)
│   │       ├── CategoryFilterBadges (selected items, removable)
│   │       └── CategoryFilterList (multi-select checkboxes)
│   ├── DropdownMenuSub (Published date)
│   │   ├── DropdownMenuSubTrigger → "Published" label + active preset label
│   │   └── DropdownMenuSubContent
│   │       └── DateFilterPresets (radio: Any time, Today, This week, This month, This year)
│   ├── DropdownMenuSub (Created date) — owner only
│   │   ├── DropdownMenuSubTrigger → "Created" label + active preset label
│   │   └── DropdownMenuSubContent
│   │       └── DateFilterPresets (same radio options, reusable component)
│   └── DropdownMenuSub (Status) — owner only
│       ├── DropdownMenuSubTrigger → "Status" label + active status label
│       └── DropdownMenuSubContent
│           └── PublishedFilterOptions (radio items: All, Draft, Published)
└── DropdownMenuSeparator + ClearAllFilters button (when filters active)
```

**Visibility by role:**

| Sub-menu | Visitor | Owner |
|----------|---------|-------|
| Category | Yes | Yes |
| Published date | Yes | Yes |
| Created date | No | Yes |
| Status | No | Yes |

### Filter State Type

```typescript
// features/articles/hooks/use-article-filter.ts

type DatePreset = "today" | "this_week" | "this_month" | "this_year";

type ArticleFilterState = {
  categories: string[];                          // multi-select, empty = all
  publishedDatePreset: DatePreset | null;        // filters on published_at, null = any time
  createdDatePreset: DatePreset | null;          // filters on created_at, null = any time (owner only)
  publishedStatus: "draft" | "published" | null; // null = all (owner only)
};

const INITIAL_FILTER_STATE: ArticleFilterState = {
  categories: [],
  publishedDatePreset: null,
  createdDatePreset: null,
  publishedStatus: null,
};
```

## Technical Considerations

### Critical Decision: Input Inside DropdownMenuSubContent

The category sub-menu requires a search input inside `DropdownMenuSubContent`. Radix's DropdownMenu manages focus and keyboard navigation for menu items. Embedding an `<input>` creates potential conflicts:

- **Arrow keys**: Input cursor movement vs. menu item navigation
- **Escape**: Clear search query vs. close sub-menu
- **Typeahead**: DropdownMenu's built-in typeahead may intercept keystrokes

**Mitigation:** Stop propagation of keyboard events on the input element so Radix's menu handlers don't intercept them. The greyboard project filter (`project-filter-search.tsx`) does this successfully within a Popover. The same pattern works in DropdownMenuSubContent since Radix checks if the event target is an input before applying typeahead.

**Phase 0 spike:** Build a minimal prototype to validate this pattern before full implementation.

### Mobile Viewport Concern

Radix sub-menus open to the side. On narrow viewports (<640px), SubContent may render off-screen. Radix handles this with collision detection (`avoidCollisions` prop is true by default), which repositions the sub-content.

**If collision detection is insufficient:** Consider conditionally rendering the filter as a sheet/drawer on mobile instead of a dropdown with sub-menus. This can be a Phase 2 enhancement.

### CSS Specificity for Active Icon State

Per documented learning (`docs/solutions/ui-bugs/ghost-button-svg-color-override.md`): apply `[&_svg]:text-information` on the **Button**, not the Icon. The ghost variant's `[&_svg]:text-icon` has higher specificity.

```tsx
// CORRECT
<Button variant="ghost" className={cn(hasActiveFilters && "[&_svg]:text-information")}>
  <Icon name="Line3Icon" />
</Button>
```

### Date Fields for Filtering

Two separate date sub-menus, each targeting its own field:

| Sub-menu | Date field | Visible to | Rationale |
|----------|-----------|------------|-----------|
| **Published date** | `published_at` | Everyone | Public-facing; answers "when was this shared?" |
| **Created date** | `created_at` | Owner only | Internal; answers "when did I write this?" Useful for finding recent drafts |

Both use the same `DatePreset` radio options and `getDateRange()` utility. The `DateFilterContent` component is reusable — it accepts a `value`, `onChange`, and `label` prop.

**Edge case:** When a non-owner has a persisted `createdDatePreset` in localStorage (from visiting their own profile), it is ignored during filtering when `isOwner` is false.

### localStorage Persistence

Mirror has no `useLocalStorage` hook. Two options:
1. Copy greyboard's `use-local-storage.ts` hook into a shared package
2. Create a simpler hook in `features/articles/hooks/`

**Recommendation:** Create a minimal `useLocalStorage` hook in `apps/mirror/hooks/` (option 2). Promote to shared package later if needed (code promotion ladder).

**Key structure:**
- Single localStorage key: `mirror.articles.filter`
- JSON-serialized `ArticleFilterState`
- Owner-only dimensions (`createdDatePreset`, `publishedStatus`) are ignored during filtering when `isOwner` is false — the values stay in localStorage but have no effect
- Global (not per-profile) — simpler, and category/date filters are user preferences

### Top-Level "Filter By..." Search Input

**Removed from spec.** With only 4 sub-menu triggers (Category, Published, Created, Status), a search input to filter these triggers adds complexity without UX value. The category sub-menu has its own dedicated search. This simplification keeps the main dropdown clean.

## Implementation Phases

### Phase 0: Spike — Validate Input-in-SubContent Pattern

**Goal:** Confirm that a search `<input>` works correctly inside `DropdownMenuSubContent`.

**Tasks:**
- [ ] Create a throwaway prototype in the filter button's current location
- [ ] Test: typing in the input (no typeahead interference)
- [ ] Test: Escape key behavior (close sub-menu, not clear input)
- [ ] Test: arrow keys in input vs. menu item navigation
- [ ] Test: mobile viewport collision detection for sub-content
- [ ] **Go/no-go decision:** If Input-in-SubContent fails, pivot to Popover approach

**Files:**
- `features/articles/components/article-filter-dropdown.tsx` (prototype)

### Phase 1: Filter State Hook + localStorage

**Goal:** Create the filter state management layer.

**Tasks:**
- [ ] Create `apps/mirror/hooks/use-local-storage.ts` — generic SSR-safe localStorage hook with JSON serialization and try/catch for corrupted data
- [ ] Create `features/articles/hooks/use-article-filter.ts` — filter state hook using `useLocalStorage`
  - Exposes: `filterState`, `toggleCategory(id)`, `setPublishedDatePreset(preset | null)`, `setCreatedDatePreset(preset | null)`, `setPublishedStatus(status | null)`, `clearAll()`, `hasActiveFilters`
  - `hasActiveFilters` must account for `isOwner` — owner-only dimensions don't count as "active" for non-owners
  - Categories: multi-select toggle (add/remove from array)
  - Published date: single-select (set or null)
  - Created date: single-select (set or null, owner only)
  - Published status: single-select (set or null, owner only)
- [ ] Create `features/articles/utils/article-filter.ts` — pure filter function
  - Input: `articles: Article[]`, `filter: ArticleFilterState`, `isOwner: boolean`
  - Category filter: `filter.categories.length === 0 || filter.categories.includes(article.category)`
  - Published date filter: compare `article.published_at` against preset range boundaries
  - Created date filter: only apply when `isOwner` is true; compare `article.created_at` against preset range boundaries
  - Published status filter: only apply when `isOwner` is true; `filter.publishedStatus === null || article.status === filter.publishedStatus`
  - Returns filtered array
- [ ] Create `features/articles/utils/date-preset.ts` — date range calculation
  - `getDateRange(preset: DatePreset): { start: Date; end: Date }`
  - Today: start of today → now
  - This week: Monday 00:00 → now
  - This month: 1st of month 00:00 → now
  - This year: Jan 1 00:00 → now

**Files:**
- `apps/mirror/hooks/use-local-storage.ts` (new)
- `features/articles/hooks/use-article-filter.ts` (new)
- `features/articles/utils/article-filter.ts` (new)
- `features/articles/utils/date-preset.ts` (new)

### Phase 2: Category Sub-Menu Components

**Goal:** Build the category filter sub-menu with search, badges, and multi-select checkboxes.

**Tasks:**
- [ ] Create `features/articles/components/filter/category-filter-content.tsx`
  - Container for the category sub-menu content
  - Local `searchQuery` state for filtering the category list
  - Derives available categories from articles (not hardcoded)
  - Computes: `filteredCategories` based on search query
- [ ] Create `features/articles/components/filter/category-filter-search.tsx`
  - Input with "Search categories..." placeholder
  - `onKeyDown` handler: stop propagation to prevent Radix typeahead interference
  - Auto-focus when sub-menu opens
- [ ] Create `features/articles/components/filter/category-filter-badges.tsx`
  - Renders selected category names as badges
  - Each badge has an X icon button (`XMarkCircleFillIcon`) to remove
  - Only renders when `selectedCategories.length > 0`
  - Includes "Clear" button when multiple selections exist
- [ ] Create `features/articles/components/filter/category-filter-list.tsx`
  - Scrollable list of checkbox items (max-height with overflow-y-auto)
  - Each item shows category name + article count
  - Uses `DropdownMenuCheckboxItem` for each category
  - Checked state driven by `filterState.categories`
  - Empty state: "No categories found" when search yields no results
- [ ] Extract unique categories from article data
  - Utility: `getUniqueCategories(articles: Article[]): { name: string; count: number }[]`
  - Sort alphabetically
  - Located in `features/articles/utils/article-filter.ts`

**Files:**
- `features/articles/components/filter/category-filter-content.tsx` (new)
- `features/articles/components/filter/category-filter-search.tsx` (new)
- `features/articles/components/filter/category-filter-badges.tsx` (new)
- `features/articles/components/filter/category-filter-list.tsx` (new)
- `features/articles/utils/article-filter.ts` (update — add `getUniqueCategories`)

### Phase 3: Date + Published Sub-Menu Components

**Goal:** Build the date preset sub-menus (published date + created date) and published state sub-menu.

**Tasks:**
- [ ] Create `features/articles/components/filter/date-filter-content.tsx`
  - **Reusable component** shared by both Published date and Created date sub-menus
  - Props: `value: DatePreset | null`, `onChange: (preset: DatePreset | null) => void`
  - Radio group with 5 items: Any time (default), Today, This week, This month, This year
  - Uses `DropdownMenuRadioGroup` + `DropdownMenuRadioItem`
  - "Any time" acts as the clear/reset option (sets value to `null`)
  - Selected value driven by `value ?? "any_time"`
- [ ] Create `features/articles/components/filter/status-filter-content.tsx`
  - Radio group with 3 items: All (default), Draft, Published
  - Uses `DropdownMenuRadioGroup` + `DropdownMenuRadioItem`
  - "All" acts as the clear/reset option (sets `publishedStatus` to `null`)
  - Only rendered when `isOwner` is true

**Usage in the main dropdown:**

```tsx
{/* Published date — visible to all */}
<DropdownMenuSub>
  <DropdownMenuSubTrigger>Published</DropdownMenuSubTrigger>
  <DropdownMenuSubContent>
    <DateFilterContent
      value={filterState.publishedDatePreset}
      onChange={setPublishedDatePreset}
    />
  </DropdownMenuSubContent>
</DropdownMenuSub>

{/* Created date — owner only */}
{isOwner && (
  <DropdownMenuSub>
    <DropdownMenuSubTrigger>Created</DropdownMenuSubTrigger>
    <DropdownMenuSubContent>
      <DateFilterContent
        value={filterState.createdDatePreset}
        onChange={setCreatedDatePreset}
      />
    </DropdownMenuSubContent>
  </DropdownMenuSub>
)}
```

**Files:**
- `features/articles/components/filter/date-filter-content.tsx` (new — reusable)
- `features/articles/components/filter/status-filter-content.tsx` (new)

### Phase 4: Main Filter Dropdown + Toolbar Integration

**Goal:** Assemble the filter dropdown and wire it into the toolbar and data pipeline.

**Tasks:**
- [ ] Create `features/articles/components/article-filter-dropdown.tsx`
  - Assembles DropdownMenu with 4 sub-menus (2 owner-only)
  - Tooltip wrapper on trigger (matching sort/search pattern)
  - Filter icon button with active state: `[&_svg]:text-information` when `hasActiveFilters`
  - Conditionally renders Created date + Status sub-menus based on `isOwner` prop
  - Clear all button at bottom of dropdown (visible when filters active)
  - Sub-trigger labels show active state info:
    - Category: `"Category"` or `"Category (3)"` when 3 selected
    - Published: `"Published"` or `"Published · This week"` when preset active
    - Created: `"Created"` or `"Created · Today"` when preset active (owner only)
    - Status: `"Status"` or `"Status · Draft"` when status set (owner only)
- [ ] Update `features/articles/components/article-toolbar.tsx`
  - Replace placeholder filter button (lines 96-107) with `<ArticleFilterDropdown>`
  - Pass props: `isOwner`, `articles` (for category extraction), filter state/handlers
- [ ] Update `features/articles/components/scrollable-article-list.tsx`
  - Add `useArticleFilter()` hook call
  - Insert filter step in pipeline: `search.filteredArticles` → `filterArticles()` → `useArticleList()`
  - Clear selection on filter change (matching search/sort pattern)
  - Pass filter props to `ArticleToolbar`
- [ ] Update `ArticleToolbar` type to accept filter props
  - Add: `articles: Article[]`, `filterState`, filter handlers, `hasActiveFilters`
- [ ] Update empty state in `scrollable-article-list.tsx`
  - Differentiate between search empty ("No articles found") and filter empty ("No articles match the current filters")
  - When both search and filter active: "No articles found matching your search and filters"

**Files:**
- `features/articles/components/article-filter-dropdown.tsx` (new)
- `features/articles/components/article-toolbar.tsx` (update)
- `features/articles/components/scrollable-article-list.tsx` (update)

### Phase 5: Polish + Animation

**Goal:** Add visual polish and animation consistency.

**Tasks:**
- [ ] Trigger list re-animation on filter change (matching sort pattern)
  - Track filter state changes with ref comparison
  - Set `shouldAnimate` flag, auto-clear after 1000ms
  - Staggered row animation via `AnimatedArticleRow`
- [ ] Add active filter count badge on the filter trigger button
  - Small dot or count indicator when filters are active
  - Matches the visual language of the greyboard filter trigger
- [ ] Keyboard shortcuts
  - Escape in category search: clear search first, then close sub-menu on second press
  - Consider `useArticleFilterKeyboard` hook if complexity warrants it

**Files:**
- `features/articles/components/scrollable-article-list.tsx` (update)
- `features/articles/components/article-filter-dropdown.tsx` (update)

## Alternative Approaches Considered

### 1. Popover with Flat Layout (Greyboard Pattern)

The greyboard project filter uses a single Popover with search, badges, and checkboxes in a flat layout. This works well for a single dimension (projects) but becomes awkward for 3 filter dimensions. Would require tabs or accordion sections within the Popover.

**Why rejected:** Doesn't scale to 3 dimensions without significant custom UI. DropdownMenu sub-menus are purpose-built for this hierarchy.

### 2. Command Menu (cmdk)

A command palette approach where typing "category: music" or "date: this week" applies filters. Powerful but has a learning curve and doesn't match the simple dropdown sub-menu UX described in the spec.

**Why rejected:** Over-engineered for the current use case. Better suited for power-user features.

### 3. Popover with Nested Popovers

Main Popover triggers open child Popovers for each dimension. Most flexible layout but requires managing multiple open states and positioning conflicts.

**Why rejected:** Complex open-state management. DropdownMenu handles sub-menu state natively.

## Acceptance Criteria

### Functional Requirements

- [ ] Filter button in article toolbar opens a DropdownMenu
- [ ] DropdownMenu contains 4 sub-menus: Category, Published date, Created date, Status
- [ ] **Category sub-menu** (visible to all):
  - [ ] Search input filters the category list in real-time
  - [ ] Checkboxes allow multi-select of categories
  - [ ] Selected badges appear above the list with X icons to remove
  - [ ] Categories are derived from actual article data with counts
  - [ ] Empty state when search matches no categories
- [ ] **Published date sub-menu** (visible to all):
  - [ ] Radio items: Any time, Today, This week, This month, This year
  - [ ] "Any time" is the default (no date filter)
  - [ ] Date comparison uses `published_at` field
- [ ] **Created date sub-menu** (owner only):
  - [ ] Only visible when `isOwner` is true
  - [ ] Same radio items as Published date (reusable `DateFilterContent` component)
  - [ ] Date comparison uses `created_at` field
- [ ] **Status sub-menu** (owner only):
  - [ ] Only visible when `isOwner` is true
  - [ ] Radio items: All, Draft, Published
  - [ ] "All" is the default (no status filter)
- [ ] Filters compose with AND logic (all dimensions must match)
- [ ] Filters compose with existing search and sort
- [ ] Filter state persists in localStorage across page navigations
- [ ] Filter changes clear article selection (matching sort/search behavior)
- [ ] Filter trigger button shows active state (`[&_svg]:text-information`) when filters applied
- [ ] Sub-trigger labels show active filter summary (count or value)
- [ ] Clear all filters button visible at bottom of dropdown when filters active
- [ ] Empty state message differentiates filter-empty from search-empty

### Non-Functional Requirements

- [ ] No flash of unfiltered content on page load (SSR-safe localStorage hook)
- [ ] Filter function is pure and testable (`article-filter.ts`)
- [ ] Date range calculation handles timezone correctly (use local timezone)
- [ ] Keyboard navigation works in sub-menus (Escape, Arrow keys)
- [ ] Search input inside DropdownMenuSubContent doesn't conflict with Radix typeahead
- [ ] Sub-menus reposition correctly on narrow viewports (Radix collision detection)

### Quality Gates

- [ ] `pnpm build --filter=@feel-good/mirror` passes
- [ ] `pnpm lint --filter=@feel-good/mirror` passes
- [ ] Filter works with 0, 1, and all categories selected
- [ ] Filter works with all date presets for both published date and created date
- [ ] Created date and Status sub-menus are hidden for non-owners
- [ ] Combined filter + search + sort produces correct results
- [ ] localStorage persistence survives page reload

## Success Metrics

- Filter reduces visible articles according to selected dimensions
- All 4 filter dimensions compose correctly with AND logic
- Filter composes with existing search and sort without conflicts
- Filter state persists across page navigations
- Created date and Status filters are invisible to non-owners

## Dependencies & Prerequisites

- Existing article toolbar with placeholder filter button (`article-toolbar.tsx:96-107`)
- Existing DropdownMenu primitive with Sub-menu support (`@feel-good/ui/primitives/dropdown-menu`)
- Existing article data pipeline in `scrollable-article-list.tsx`
- Article type with `category`, `created_at`, `status` fields (`mock-articles.ts`)

## Risk Analysis & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Input-in-SubContent keyboard conflicts | Medium | High | Phase 0 spike validates before full build |
| Sub-menus off-screen on mobile | Low | Medium | Radix collision detection; Phase 2 sheet fallback if needed |
| localStorage hydration flash | Low | Low | SSR-safe hook with initial state; lazy read in useEffect |
| Filter + search + sort interaction bugs | Medium | Medium | Pure filter function is testable; clear separation of concerns |
| Owner-only filter persistence for non-owners | Low | Medium | Ignore `createdDatePreset` and `publishedStatus` when `isOwner` is false |

## Future Considerations

- **Mobile sheet fallback:** If sub-menus don't work well on mobile, convert to a sheet/drawer UI for narrow viewports
- **Tag-based categories:** If articles gain multiple tags instead of single category, the filter adapts easily (array intersection instead of equality)
- **Saved filter presets:** Users could save named filter combinations
- **URL-based filter state:** Persist filters in URL params for shareable filtered views
- **Backend filtering:** When articles move from mock data to Convex, the filter function becomes a query predicate

## File Summary

### New Files

| File | Purpose |
|------|---------|
| `apps/mirror/hooks/use-local-storage.ts` | SSR-safe localStorage hook |
| `features/articles/hooks/use-article-filter.ts` | Filter state management |
| `features/articles/utils/article-filter.ts` | Pure filter function + category extraction |
| `features/articles/utils/date-preset.ts` | Date range calculation for presets |
| `features/articles/components/article-filter-dropdown.tsx` | Main filter dropdown container |
| `features/articles/components/filter/category-filter-content.tsx` | Category sub-menu container |
| `features/articles/components/filter/category-filter-search.tsx` | Category search input |
| `features/articles/components/filter/category-filter-badges.tsx` | Selected category badges |
| `features/articles/components/filter/category-filter-list.tsx` | Category checkbox list |
| `features/articles/components/filter/date-filter-content.tsx` | Reusable date preset radio group (used by Published date + Created date) |
| `features/articles/components/filter/status-filter-content.tsx` | Published status radio group (owner only) |

### Modified Files

| File | Change |
|------|--------|
| `features/articles/components/article-toolbar.tsx` | Replace placeholder with filter dropdown, update props |
| `features/articles/components/scrollable-article-list.tsx` | Add filter hook, insert in pipeline, pass filter props |

## References & Research

### Internal References

- Reference implementation: `apps/greyboard/app/(protected)/dashboard/tasks/_components/tasks-header-project-filter.tsx`
- Sort dropdown pattern: `apps/mirror/features/articles/components/article-sort-dropdown.tsx`
- Search pattern: `apps/mirror/features/articles/hooks/use-article-search.ts`
- Selection clearing pattern: `apps/mirror/features/articles/components/scrollable-article-list.tsx:53-73`
- Icon active state fix: `docs/solutions/ui-bugs/ghost-button-svg-color-override.md`
- DropdownMenu primitive: `packages/ui/src/primitives/dropdown-menu.tsx`
- Article type: `apps/mirror/features/articles/lib/mock-articles.ts:1-10`

### SpecFlow Open Questions Resolved

| Question | Resolution |
|----------|-----------|
| Top-level "filter by..." search | **Removed** — unnecessary for 4 triggers; category has its own search |
| Date field: `created_at` vs `published_at` | **Both** — two separate sub-menus: Published date (`published_at`, visible to all) and Created date (`created_at`, owner only) |
| Published filter: radio or checkbox | **Radio** with "All" default — clear 3-state semantics |
| Filter change clears selection | **Yes** — matches search/sort pattern |
| Per-profile or global persistence | **Global** — published filter ignored when `isOwner` is false |
| Filter active indicator | **`[&_svg]:text-information`** on trigger button when filters active |
| Empty state messaging | **Differentiated** — separate messages for filter-empty vs search-empty |
| Clear all filters | **Yes** — button at bottom of dropdown when any filter active |
| Category list source | **Derived from article data** — not hardcoded |
| Date radio deselect | **"Any time" radio option** — always selectable as reset |
| Week boundary | **Monday** (ISO standard) |
| Dropdown close on selection | Category: stays open. Published date: closes. Created date: closes. Status: closes. |
