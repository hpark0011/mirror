---
title: "orchestration: Article List Filter"
type: orchestration
date: 2026-02-12
source: docs/plans/2026-02-12-feat-article-list-filter-plan.md
---

# Agent Orchestration: Article List Filter

## Overview

| Field            | Value                                                                                    |
| ---------------- | ---------------------------------------------------------------------------------------- |
| **Feature**      | Multi-dimension article list filter (category, published date, created date, status)     |
| **Target**       | `apps/mirror/`, `packages/features/articles/`                                            |
| **Scope**        | Large (5 phases, 11 agents)                                                              |
| **Strategy**     | Checkpoint team — user checkpoint every 2 phases                                         |
| **New files**    | 11                                                                                       |
| **Modified**     | 2                                                                                        |
| **Quality gate** | `pnpm build --filter=@feel-good/mirror` after every phase                                |

---

## Execution Graph

```
Phase 1: Foundation (2 agents parallel)
    │
    ▼
Phase 2: Logic Layer (2 agents parallel)
    │
    ├──────────────────────┐
    ▼                      ▼
Phase 3: Category UI    Phase 4: Date + Status UI
(3 agents)              (2 agents parallel)
    │                      │
    └──────────┬───────────┘
               ▼
Phase 5: Composition + Integration (2 agents sequential)
```

---

## Phase 1: Foundation

**Pattern:** `foundation`
**Goal:** Create standalone utility layers with zero article-feature dependencies.
**Depends on:** Nothing

### Files

| # | File                                                  | Status | Agent |
| - | ----------------------------------------------------- | ------ | ----- |
| 1 | `apps/mirror/hooks/use-local-storage.ts`              | new    | A     |
| 2 | `apps/mirror/features/articles/utils/date-preset.ts`  | new    | B     |

### Agent A — useLocalStorage Hook

- **Type:** `general-purpose` · **Model:** `haiku` · **Mode:** `bypassPermissions`
- **Parallel:** Yes (with Agent B)

**Task:**

Create an SSR-safe `useLocalStorage<T>` hook in `apps/mirror/hooks/use-local-storage.ts`.

Reference: `apps/greyboard/hooks/use-local-storage.ts` (proven pattern with cross-tab sync).

Requirements:
- Signature: `useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void, () => void]`
- SSR-safe: initialize with `initialValue`, load from localStorage in `useEffect`
- Cross-tab sync via `StorageEvent` listener
- Same-tab sync via custom `CustomEvent("local-storage-change")` (dispatched with `queueMicrotask`)
- JSON serialization with try/catch for corrupted data and `QuotaExceededError`
- `"use client"` directive at top
- Handle `undefined` by removing the key

### Agent B — Date Preset Utility

- **Type:** `general-purpose` · **Model:** `haiku` · **Mode:** `bypassPermissions`
- **Parallel:** Yes (with Agent A)

**Task:**

Create a pure date range utility in `apps/mirror/features/articles/utils/date-preset.ts`.

Requirements:
- Export type: `type DatePreset = "today" | "this_week" | "this_month" | "this_year"`
- Export function: `getDateRange(preset: DatePreset): { start: Date; end: Date }`
  - Today: start of today 00:00 → now
  - This week: Monday 00:00 → now (ISO week starts Monday)
  - This month: 1st of current month 00:00 → now
  - This year: Jan 1 00:00 → now
- All dates in local timezone
- No React imports — pure utility

### Validator

- **Type:** `Explore` · **Model:** `sonnet`

Check:
- `useLocalStorage` handles SSR (no `window` access during render)
- `getDateRange` handles Monday-as-week-start correctly
- Both files have no React runtime dependencies that would break server rendering
- Import paths follow codebase conventions

### Quality Gate

```bash
pnpm build --filter=@feel-good/mirror
```

---

## Phase 2: Logic Layer

**Pattern:** `logic-layer`
**Goal:** Create filter state management and pure filter function.
**Depends on:** Phase 1

### Files

| # | File                                                            | Status | Agent |
| - | --------------------------------------------------------------- | ------ | ----- |
| 3 | `apps/mirror/features/articles/hooks/use-article-filter.ts`     | new    | A     |
| 4 | `apps/mirror/features/articles/utils/article-filter.ts`         | new    | B     |

### Agent A — Filter State Hook

- **Type:** `general-purpose` · **Model:** `haiku` · **Mode:** `bypassPermissions`
- **Parallel:** Yes (with Agent B)

**Task:**

Create the filter state management hook in `apps/mirror/features/articles/hooks/use-article-filter.ts`.

Reference patterns:
- `apps/mirror/features/articles/hooks/use-article-sort.ts` (simple state hook pattern)
- `apps/mirror/features/articles/hooks/use-article-search.ts` (return-type shape)

Requirements:
- `"use client"` directive
- Import `useLocalStorage` from `@/hooks/use-local-storage`
- Import `DatePreset` from `../utils/date-preset`
- Define and export `ArticleFilterState` type inline:
  ```typescript
  type ArticleFilterState = {
    categories: string[];
    publishedDatePreset: DatePreset | null;
    createdDatePreset: DatePreset | null;
    publishedStatus: "draft" | "published" | null;
  };
  ```
- Define `INITIAL_FILTER_STATE` constant (all empty/null)
- localStorage key: `"mirror.articles.filter"`
- Export `useArticleFilter()` hook returning:
  - `filterState: ArticleFilterState`
  - `toggleCategory(name: string)` — add/remove from categories array
  - `setPublishedDatePreset(preset: DatePreset | null)`
  - `setCreatedDatePreset(preset: DatePreset | null)`
  - `setPublishedStatus(status: "draft" | "published" | null)`
  - `clearAll()` — reset to `INITIAL_FILTER_STATE`
  - `hasActiveFilters: boolean` — true when any dimension is non-default
- `hasActiveFilters` is a simple computed value (does NOT account for `isOwner` — that's handled at the filter application layer)

### Agent B — Pure Filter Function

- **Type:** `general-purpose` · **Model:** `haiku` · **Mode:** `bypassPermissions`
- **Parallel:** Yes (with Agent A)

**Task:**

Create pure filter functions in `apps/mirror/features/articles/utils/article-filter.ts`.

Requirements:
- Import `Article` type from `../lib/mock-articles`
- Import `DatePreset` and `getDateRange` from `./date-preset`
- Import `ArticleFilterState` from `../hooks/use-article-filter` — NOTE: To avoid circular dependency, define `ArticleFilterState` locally or accept it as a generic. Actually, since the hook file exports the type, importing it is fine (no circular dep — utils imports type from hooks, hooks does NOT import from this file).

**Actually, to avoid any potential circular dependency concerns, define the `ArticleFilterState` type in this file and re-export it from the hook file. Both files can import `DatePreset` from `date-preset.ts`.**

Revised approach:
- Define and export `ArticleFilterState` in THIS file (`article-filter.ts`)
- The hook file (`use-article-filter.ts`) imports `ArticleFilterState` from `../utils/article-filter`

Functions to export:
1. `filterArticles(articles: Article[], filter: ArticleFilterState, isOwner: boolean): Article[]`
   - Category: `filter.categories.length === 0 || filter.categories.includes(article.category)`
   - Published date: compare `article.published_at` against `getDateRange(filter.publishedDatePreset)` — skip if null
   - Created date: only apply when `isOwner === true` AND `filter.createdDatePreset !== null`
   - Published status: only apply when `isOwner === true` AND `filter.publishedStatus !== null`
   - AND logic: all dimensions must match
2. `getUniqueCategories(articles: Article[]): { name: string; count: number }[]`
   - Extract unique categories from articles
   - Count articles per category
   - Sort alphabetically by name

### Validator

- **Type:** `Explore` · **Model:** `sonnet`

Check:
- No circular dependencies between `use-article-filter.ts` and `article-filter.ts`
- `ArticleFilterState` type is defined in `article-filter.ts` and imported by the hook
- `filterArticles` correctly skips owner-only dimensions when `isOwner` is false
- `getUniqueCategories` handles empty arrays
- Date comparisons handle string-to-Date parsing for `published_at` and `created_at`

### Quality Gate

```bash
pnpm build --filter=@feel-good/mirror
```

### Checkpoint

> **Phases 1 and 2 complete.** Foundation utilities (localStorage hook, date presets) and logic layer (filter state hook, pure filter function) are built. Continue to UI components?

---

## Phase 3: Category Sub-Menu UI

**Pattern:** `ui-components`
**Goal:** Build the 4 category filter sub-menu components.
**Depends on:** Phase 2 (for `getUniqueCategories`)

### Files

| # | File                                                                               | Status | Agent |
| - | ---------------------------------------------------------------------------------- | ------ | ----- |
| 5 | `apps/mirror/features/articles/components/filter/category-filter-search.tsx`        | new    | A     |
| 6 | `apps/mirror/features/articles/components/filter/category-filter-badges.tsx`        | new    | A     |
| 7 | `apps/mirror/features/articles/components/filter/category-filter-list.tsx`          | new    | B     |
| 8 | `apps/mirror/features/articles/components/filter/category-filter-content.tsx`       | new    | C     |

### Agent A — Search + Badges (leaf components)

- **Type:** `general-purpose` · **Model:** `haiku` · **Mode:** `bypassPermissions`
- **Parallel:** Yes (with Agent B)

**Task:**

Create 2 leaf components in `apps/mirror/features/articles/components/filter/`.

**File 1: `category-filter-search.tsx`**
- `"use client"` directive
- Props: `value: string`, `onChange: (query: string) => void`
- Renders `Input` from `@feel-good/ui/primitives/input`
- Placeholder: `"Search categories..."`
- Critical: `onKeyDown` handler must call `e.stopPropagation()` to prevent Radix DropdownMenu typeahead from intercepting keystrokes
- Styling: small input, no border focus ring inside dropdown context
- Reference: `apps/greyboard/app/(protected)/dashboard/tasks/_components/project-filter-search.tsx` for stopPropagation pattern

**File 2: `category-filter-badges.tsx`**
- `"use client"` directive
- Props: `selectedCategories: string[]`, `onRemove: (name: string) => void`
- Only renders when `selectedCategories.length > 0`
- Each badge: category name + clickable X icon to remove
- Use `Badge` from `@feel-good/ui/primitives/badge` if available, otherwise simple `span` with badge styling
- Wrap in a flex container with gap and flex-wrap

### Agent B — Checkbox List (leaf component)

- **Type:** `general-purpose` · **Model:** `haiku` · **Mode:** `bypassPermissions`
- **Parallel:** Yes (with Agent A)

**Task:**

Create `apps/mirror/features/articles/components/filter/category-filter-list.tsx`.

- `"use client"` directive
- Props: `categories: { name: string; count: number }[]`, `selectedCategories: string[]`, `onToggle: (name: string) => void`
- Scrollable container: `max-h-[200px] overflow-y-auto`
- Each item: `DropdownMenuCheckboxItem` from `@feel-good/ui/primitives/dropdown-menu`
  - `checked={selectedCategories.includes(category.name)}`
  - `onCheckedChange={() => onToggle(category.name)}`
  - `onSelect={(e) => e.preventDefault()}` — prevents dropdown from closing on selection
  - Display: category name + article count (muted)
- Empty state: `<p className="px-2 py-4 text-sm text-muted-foreground">No categories found</p>`
- Reference: `packages/ui/src/primitives/dropdown-menu.tsx` for `DropdownMenuCheckboxItem` API

### Agent C — Content Container (sequential)

- **Type:** `general-purpose` · **Model:** `haiku` · **Mode:** `bypassPermissions`
- **Sequential:** Runs after Agent A and Agent B complete

**Task:**

Create `apps/mirror/features/articles/components/filter/category-filter-content.tsx`.

- `"use client"` directive
- Props: `articles: Article[]`, `selectedCategories: string[]`, `onToggleCategory: (name: string) => void`
- Import `Article` type from `../../lib/mock-articles`
- Import `getUniqueCategories` from `../../utils/article-filter`
- Import `CategoryFilterSearch` from `./category-filter-search`
- Import `CategoryFilterBadges` from `./category-filter-badges`
- Import `CategoryFilterList` from `./category-filter-list`
- Local state: `const [searchQuery, setSearchQuery] = useState("")`
- Derive: `allCategories = useMemo(() => getUniqueCategories(articles), [articles])`
- Derive: `filteredCategories = allCategories.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))`
- Compose: `<CategoryFilterSearch>` → `<DropdownMenuSeparator>` → `<CategoryFilterBadges>` → `<CategoryFilterList>`

### Validator

- **Type:** `Explore` · **Model:** `sonnet`

Check:
- `category-filter-search.tsx` has `e.stopPropagation()` in `onKeyDown`
- `category-filter-list.tsx` uses `onSelect={(e) => e.preventDefault()}` to keep dropdown open
- `category-filter-content.tsx` correctly composes all 3 sub-components
- All files have `"use client"` directive
- Import paths are correct relative imports

### Quality Gate

```bash
pnpm build --filter=@feel-good/mirror
```

---

## Phase 4: Date + Status Sub-Menu UI

**Pattern:** `ui-components`
**Goal:** Build date preset and status filter sub-menu components.
**Depends on:** Phase 1 (for `DatePreset` type from `date-preset.ts`)
**Runs in parallel with:** Phase 3

### Files

| #  | File                                                                            | Status | Agent |
| -- | ------------------------------------------------------------------------------- | ------ | ----- |
| 9  | `apps/mirror/features/articles/components/filter/date-filter-content.tsx`       | new    | A     |
| 10 | `apps/mirror/features/articles/components/filter/status-filter-content.tsx`     | new    | B     |

### Agent A — Date Filter Content

- **Type:** `general-purpose` · **Model:** `haiku` · **Mode:** `bypassPermissions`
- **Parallel:** Yes (with Agent B)

**Task:**

Create reusable date preset radio group in `apps/mirror/features/articles/components/filter/date-filter-content.tsx`.

- `"use client"` directive
- Props: `value: DatePreset | null`, `onChange: (preset: DatePreset | null) => void`
- Import `DatePreset` from `../../utils/date-preset`
- Import `DropdownMenuRadioGroup`, `DropdownMenuRadioItem` from `@feel-good/ui/primitives/dropdown-menu`
- Radio items (5): "Any time" → `null`, "Today" → `"today"`, "This week" → `"this_week"`, "This month" → `"this_month"`, "This year" → `"this_year"`
- Use `"any_time"` as the RadioGroup value when `value` is `null`
- In `onValueChange`: map `"any_time"` back to `null`, cast others to `DatePreset`
- Reference: `apps/mirror/features/articles/components/article-sort-dropdown.tsx` lines 52-63 for RadioGroup pattern

### Agent B — Status Filter Content

- **Type:** `general-purpose` · **Model:** `haiku` · **Mode:** `bypassPermissions`
- **Parallel:** Yes (with Agent A)

**Task:**

Create published status radio group in `apps/mirror/features/articles/components/filter/status-filter-content.tsx`.

- `"use client"` directive
- Props: `value: "draft" | "published" | null`, `onChange: (status: "draft" | "published" | null) => void`
- Import `DropdownMenuRadioGroup`, `DropdownMenuRadioItem` from `@feel-good/ui/primitives/dropdown-menu`
- Radio items (3): "All" → `null`, "Draft" → `"draft"`, "Published" → `"published"`
- Use `"all"` as the RadioGroup value when `value` is `null`
- In `onValueChange`: map `"all"` back to `null`

### Validator

- **Type:** `Explore` · **Model:** `sonnet`

Check:
- Both components handle null ↔ sentinel value mapping correctly
- RadioGroup `onValueChange` types are correct
- Both files are presentational (no hooks, no side effects)
- Import paths are correct

### Quality Gate

```bash
pnpm build --filter=@feel-good/mirror
```

### Checkpoint

> **Phases 3 and 4 complete.** All sub-menu UI components are built (category search/badges/list/container, date presets, status filter). Continue to final composition?

---

## Phase 5: Composition + Integration

**Pattern:** `composition`
**Goal:** Assemble the main filter dropdown, replace toolbar placeholder, wire into data pipeline.
**Depends on:** Phases 2, 3, 4

### Files

| #  | File                                                                          | Status   | Agent |
| -- | ----------------------------------------------------------------------------- | -------- | ----- |
| 11 | `apps/mirror/features/articles/components/article-filter-dropdown.tsx`        | new      | A     |
| 12 | `apps/mirror/features/articles/components/article-toolbar.tsx`                | modified | B     |
| 13 | `apps/mirror/features/articles/components/scrollable-article-list.tsx`        | modified | B     |

### Agent A — Main Filter Dropdown

- **Type:** `general-purpose` · **Model:** `haiku` · **Mode:** `bypassPermissions`
- **Sequential:** Runs first

**Task:**

Create the main filter dropdown in `apps/mirror/features/articles/components/article-filter-dropdown.tsx`.

Reference: `apps/mirror/features/articles/components/article-sort-dropdown.tsx` (Tooltip + DropdownMenu trigger pattern)

Requirements:
- `"use client"` directive
- Props:
  ```typescript
  type ArticleFilterDropdownProps = {
    isOwner: boolean;
    articles: Article[];
    filterState: ArticleFilterState;
    hasActiveFilters: boolean;
    onToggleCategory: (name: string) => void;
    onSetPublishedDatePreset: (preset: DatePreset | null) => void;
    onSetCreatedDatePreset: (preset: DatePreset | null) => void;
    onSetPublishedStatus: (status: "draft" | "published" | null) => void;
    onClearAll: () => void;
  };
  ```
- `useState(false)` for `open` state
- Trigger: `Tooltip` → `TooltipTrigger asChild` → `DropdownMenuTrigger asChild` → `Button variant="ghost" size="icon-sm"`
  - Icon: `<Icon name="Line3Icon" />`
  - Active class: `cn((open || hasActiveFilters) && "[&_svg]:text-information")` on the **Button**
  - Tooltip text: "Filter"
- Content: `DropdownMenuContent align="end"`
  - **Category sub-menu** (visible to all):
    - `DropdownMenuSub` → `DropdownMenuSubTrigger` label: `"Category"` or `"Category (N)"` when N selected → `DropdownMenuSubContent` → `<CategoryFilterContent>`
  - **Published date sub-menu** (visible to all):
    - `DropdownMenuSub` → `DropdownMenuSubTrigger` label: `"Published"` or `"Published · This week"` → `DropdownMenuSubContent` → `<DateFilterContent>`
  - **Created date sub-menu** (owner only):
    - `{isOwner && <DropdownMenuSub>}` → `DropdownMenuSubTrigger` label: `"Created"` or `"Created · Today"` → `DropdownMenuSubContent` → `<DateFilterContent>`
  - **Status sub-menu** (owner only):
    - `{isOwner && <DropdownMenuSub>}` → `DropdownMenuSubTrigger` label: `"Status"` or `"Status · Draft"` → `DropdownMenuSubContent` → `<StatusFilterContent>`
  - **Clear all** (when filters active):
    - `DropdownMenuSeparator` → `DropdownMenuItem` with "Clear all filters" label, calls `onClearAll`

### Agent B — Toolbar + Pipeline Integration

- **Type:** `general-purpose` · **Model:** `haiku` · **Mode:** `bypassPermissions`
- **Sequential:** Runs after Agent A completes

**Task:**

Modify 2 files to wire the filter into the toolbar and data pipeline.

**File 1: `apps/mirror/features/articles/components/article-toolbar.tsx`**

Read the current file first. Then:
- Import `ArticleFilterDropdown` from `./article-filter-dropdown`
- Import `ArticleFilterState` from `../utils/article-filter`
- Import `DatePreset` from `../utils/date-preset`
- Extend `ArticleToolbarProps` with filter props:
  ```typescript
  articles: Article[];
  filterState: ArticleFilterState;
  hasActiveFilters: boolean;
  onToggleCategory: (name: string) => void;
  onSetPublishedDatePreset: (preset: DatePreset | null) => void;
  onSetCreatedDatePreset: (preset: DatePreset | null) => void;
  onSetPublishedStatus: (status: "draft" | "published" | null) => void;
  onClearAll: () => void;
  ```
- Replace the placeholder filter button (lines ~96-107) with `<ArticleFilterDropdown>` passing all filter props

**File 2: `apps/mirror/features/articles/components/scrollable-article-list.tsx`**

Read the current file first. Then:
- Import `useArticleFilter` from `../hooks/use-article-filter`
- Import `filterArticles` from `../utils/article-filter`
- Add `const filter = useArticleFilter()` hook call
- Insert filter step in pipeline:
  ```typescript
  const filteredByFilter = useMemo(
    () => filterArticles(search.filteredArticles, filter.filterState, isOwner),
    [search.filteredArticles, filter.filterState, isOwner]
  );
  ```
- Pass `filteredByFilter` to `useArticleList()` instead of `search.filteredArticles`
- Clear selection on filter change: add `filter.filterState` to the effect dependency that clears selection (matching existing search/sort pattern)
- Pass filter props to `<ArticleToolbar>`:
  - `articles={articles}` (unfiltered, for category extraction)
  - `filterState={filter.filterState}`
  - `hasActiveFilters={filter.hasActiveFilters}`
  - `onToggleCategory={filter.toggleCategory}`
  - `onSetPublishedDatePreset={filter.setPublishedDatePreset}`
  - `onSetCreatedDatePreset={filter.setCreatedDatePreset}`
  - `onSetPublishedStatus={filter.setPublishedStatus}`
  - `onClearAll={filter.clearAll}`
- Update `isFiltered` to account for both search and filter (for animation/empty state)

### Validator

- **Type:** `Explore` · **Model:** `sonnet`

Check:
- `article-filter-dropdown.tsx` conditionally renders Created date and Status sub-menus with `{isOwner && ...}`
- `article-toolbar.tsx` passes all filter props through to `ArticleFilterDropdown`
- `scrollable-article-list.tsx` pipeline order is correct: search → filter → sort → paginate
- Unfiltered `articles` (not `filteredByFilter`) passed to toolbar for category extraction
- Selection clearing effect includes `filter.filterState` in dependencies
- Active icon state uses `[&_svg]:text-information` on Button (not Icon)
- No scope creep — only the 3 files listed are touched

### Quality Gate

```bash
pnpm build --filter=@feel-good/mirror
```

---

## Integration Verification

After all phases complete, run a final integration agent:

- **Type:** `general-purpose` · **Model:** `haiku` · **Mode:** `bypassPermissions`

**Task:**
1. Verify all 11 new files exist and export correctly
2. Verify no unused imports or missing dependencies
3. Verify `scrollable-article-list.tsx` pipeline: search → filter → sort → paginate
4. Run final build: `pnpm build --filter=@feel-good/mirror`

---

## Agent Budget

| Phase | Agents | Parallel? | Model  |
| ----- | ------ | --------- | ------ |
| 1     | 2 exec + 1 validator | A ∥ B   | haiku + sonnet |
| 2     | 2 exec + 1 validator | A ∥ B   | haiku + sonnet |
| 3     | 3 exec + 1 validator | A ∥ B → C | haiku + sonnet |
| 4     | 2 exec + 1 validator | A ∥ B   | haiku + sonnet |
| 5     | 2 exec + 1 validator | A → B   | haiku + sonnet |
| Final | 1 integration        | —       | haiku |

**Total executor agents:** 11
**Total validator agents:** 5
**Total agents:** 17 (within budget with validators)

---

## Error Recovery

| Failure                | Recovery                                              |
| ---------------------- | ----------------------------------------------------- |
| Validator rejects      | Retry executor with feedback (max 2 retries)          |
| Quality gate fails     | Spawn fix agent with error output (max 1 retry)       |
| Agent timeout/crash    | Retry specific agent                                  |
| Phase 3+4 parallel collision | Should not happen — entirely different files     |
| Persistent failure     | Stop, report partial progress, ask user               |

---

## File Summary

### New Files (11)

| # | File                                                                             | Phase |
|---|----------------------------------------------------------------------------------|-------|
| 1 | `apps/mirror/hooks/use-local-storage.ts`                                         | 1     |
| 2 | `apps/mirror/features/articles/utils/date-preset.ts`                             | 1     |
| 3 | `apps/mirror/features/articles/hooks/use-article-filter.ts`                      | 2     |
| 4 | `apps/mirror/features/articles/utils/article-filter.ts`                          | 2     |
| 5 | `apps/mirror/features/articles/components/filter/category-filter-search.tsx`      | 3     |
| 6 | `apps/mirror/features/articles/components/filter/category-filter-badges.tsx`      | 3     |
| 7 | `apps/mirror/features/articles/components/filter/category-filter-list.tsx`        | 3     |
| 8 | `apps/mirror/features/articles/components/filter/category-filter-content.tsx`     | 3     |
| 9 | `apps/mirror/features/articles/components/filter/date-filter-content.tsx`         | 4     |
| 10| `apps/mirror/features/articles/components/filter/status-filter-content.tsx`       | 4     |
| 11| `apps/mirror/features/articles/components/article-filter-dropdown.tsx`            | 5     |

### Modified Files (2)

| # | File                                                                             | Phase |
|---|----------------------------------------------------------------------------------|-------|
| 12| `apps/mirror/features/articles/components/article-toolbar.tsx`                   | 5     |
| 13| `apps/mirror/features/articles/components/scrollable-article-list.tsx`           | 5     |

---

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Type location | `ArticleFilterState` in `article-filter.ts`, `DatePreset` in `date-preset.ts` | Co-locate types with their logic, matching `SortOrder` in `use-article-sort.ts` |
| No barrel export for `filter/` | Direct relative imports | Barrel re-exports are dead indirection per codebase convention |
| `hasActiveFilters` ignores `isOwner` | Simple computed value in hook | Owner-only filtering handled at `filterArticles()` layer |
| Phase 3 ∥ Phase 4 | Run simultaneously | Zero file overlap, independent sub-menu groups |
| Phase 5 sequential | A then B | `article-toolbar.tsx` imports from `article-filter-dropdown.tsx` |
| localStorage key | `"mirror.articles.filter"` | App-prefixed, matches plan document |
