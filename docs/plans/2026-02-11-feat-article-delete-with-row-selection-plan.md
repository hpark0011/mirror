---
title: "feat: Article delete with row selection"
type: feat
date: 2026-02-11
scope: apps/mirror
branch: mirror/021126-CMS_action_buttons
---

# Article Delete with Row Selection

## Overview

Add owner-only row selection and bulk delete functionality to the articles table on the profile page. When the authenticated profile owner views their own profile, checkboxes appear on each row. Selecting one or more articles enables a delete button above the table. Clicking delete opens a confirmation dialog.

## Problem Statement / Motivation

The profile page currently displays articles as a read-only list. Profile owners have no way to manage their content. This is the first CMS capability — delete with selection — laying groundwork for future create/edit.

## Proposed Solution

### Architecture

```
page.tsx (server)
  └─ ScrollableArticleList (client)
       ├─ useArticleSelection() — new hook, manages Set<slug>
       ├─ ArticleToolbar — new component, delete button + count
       └─ ArticleListView
            ├─ Header checkbox (select all / indeterminate)
            └─ ArticleListItem
                 └─ Checkbox cell (z-10 above link overlay)
```

**Key decisions:**

1. **Selection state** lives in a `useArticleSelection` hook inside `features/articles/hooks/`. Returns `{ selectedSlugs, toggle, toggleAll, clear, isAllSelected, isIndeterminate, count }`. This keeps selection orthogonal to the existing `useArticleList` pagination hook.

2. **Mutable articles state** — `ScrollableArticleList` wraps the incoming `articles` prop in `useState`. A `handleDelete` callback filters out selected slugs and clears selection. When backend arrives, this becomes a mutation call instead.

3. **Checkbox-vs-link conflict** — Each `ArticleListItem` uses `after:absolute after:inset-0` on the Link. The new checkbox `<TableCell>` gets `relative z-10` so clicks on the checkbox don't trigger navigation. The link overlay continues to cover the remaining cells.

4. **Owner gating** — The existing `useIsProfileOwner()` hook controls whether checkboxes and the toolbar render. Non-owners see the table exactly as it is today.

### Component Breakdown

#### `useArticleSelection` hook

```
features/articles/hooks/use-article-selection.ts
```

- `selectedSlugs: Set<string>` — internal state
- `toggle(slug)` — add/remove a single slug
- `toggleAll(allSlugs)` — if all selected, clear; otherwise select all
- `clear()` — reset selection
- Derived: `count`, `isAllSelected`, `isIndeterminate`, `isSelected(slug)`

#### `ArticleToolbar` component

```
features/articles/components/article-toolbar.tsx
```

- Renders above the table, inside the `<section>` wrapper
- Contains a single `<Button>` with `<Icon name="TrashFillIcon" />`
- Button is `variant="ghost"`, `size="icon-sm"`, disabled when `count === 0`
- When enabled, shows selection count badge or text
- Wraps the `<AlertDialog>` trigger

#### `DeleteArticlesDialog` view

```
features/articles/views/delete-articles-dialog.tsx
```

- Pure view — receives `count` and `onConfirm` props
- Uses `AlertDialogContent size="sm"`
- Copy:
  - Title: `Delete {count === 1 ? "article" : "articles"}`
  - Description: `This will permanently delete {count} {count === 1 ? "article" : "articles"}. This action cannot be undone.`
  - Cancel: `Cancel`
  - Action: `Delete` (variant="destructive")

#### Modified `ArticleListView`

- Conditionally renders a `<TableHead>` checkbox cell when `isOwner`
- Header checkbox reflects `isAllSelected` / `isIndeterminate` state
- Passes `isOwner` and `isSelected` + `onToggle` to each `ArticleListItem`

#### Modified `ArticleListItem`

- Conditionally renders a `<TableCell>` with `<Checkbox>` when `isOwner`
- Checkbox cell styled with `relative z-10` to sit above the link overlay
- `TableRow` gets `data-state={isSelected ? "selected" : undefined}` for built-in highlight

### Separation of Concerns

| Layer | Responsibility | File |
|-------|---------------|------|
| State | Selection set management | `use-article-selection.ts` |
| Logic | Delete handler (filter articles, clear selection) | `scrollable-article-list.tsx` |
| UI — Toolbar | Delete button + dialog trigger | `article-toolbar.tsx` |
| UI — Dialog | Confirmation copy + actions | `delete-articles-dialog.tsx` |
| UI — Table | Checkbox rendering, row highlight | `article-list-view.tsx`, `article-list-item.tsx` |

## Technical Considerations

### Checkbox vs Link Overlay

The existing `ArticleListItem` makes the entire row clickable via:
```tsx
<Link className="after:absolute after:inset-0" ... />
```

The checkbox cell must intercept clicks before they reach this overlay. Solution:
```tsx
<TableCell className="relative z-10 w-10">
  <Checkbox checked={isSelected} onCheckedChange={() => onToggle(slug)} />
</TableCell>
```

The `relative z-10` creates a new stacking context above the `after:absolute after:inset-0` link overlay. This is the minimal change — no need to restructure the existing Link pattern.

### Column Width Adjustment

Current: Title (3/5), Category (1/5), Published (1/5)

With checkbox column: Checkbox (w-10 fixed), Title (flex-grow or adjusted fraction), Category (1/5), Published (1/5). The checkbox column is narrow enough that a slight compression of the title column is acceptable.

### Empty State

When all articles are deleted, show a centered text: "No articles yet." inside the table section. No CTA (create doesn't exist yet).

### Mobile Considerations

- Checkbox touch targets: Radix Checkbox renders at sufficient size. The `TableCell` provides additional padding.
- Delete button placement: Inside the `<section>` above the table, which scrolls with the content in the mobile drawer. Acceptable for 30 mock items.
- On mobile, the Category column is already hidden (`hidden md:table-cell`). The checkbox column adds minimal width.

### Mock Data Scope Boundary

This implementation is mock-data only. The following are **deferred to backend integration**:

- [ ] Loading/pending states during deletion
- [ ] Error handling and retry
- [ ] Toast notifications after deletion
- [ ] Optimistic updates
- [ ] Server-side ownership verification in mutations
- [ ] Pagination interaction with "select all"

## Acceptance Criteria

### Functional

- [x] Non-owners see the article table unchanged (no checkboxes, no toolbar)
- [x] Owners see a checkbox on each article row
- [x] Owners see a header checkbox that toggles all/none
- [x] Header checkbox shows indeterminate state when partially selected
- [x] Delete button appears above the table header, disabled when nothing selected
- [x] Delete button shows `TrashFillIcon` icon
- [x] Clicking delete opens an `AlertDialog` with destructive confirmation
- [x] Dialog copy reflects the count (singular/plural)
- [x] Confirming deletes the selected articles from the list
- [x] Canceling preserves selection and articles
- [x] Selection resets after successful deletion
- [x] Empty state shows "No articles yet" when all articles deleted
- [x] `data-state="selected"` applied to selected rows for visual highlight

### Non-Functional

- [x] Checkbox click does NOT trigger row navigation
- [x] Components follow SRP — state, UI, logic clearly separated
- [x] No unnecessary re-renders (selection changes don't re-render unaffected rows)
- [x] Works on both desktop (resizable panel) and mobile (drawer) layouts

## Files to Create

| File | Purpose |
|------|---------|
| `apps/mirror/features/articles/hooks/use-article-selection.ts` | Selection state hook |
| `apps/mirror/features/articles/components/article-toolbar.tsx` | Toolbar with delete button |
| `apps/mirror/features/articles/views/delete-articles-dialog.tsx` | Confirmation dialog view |

## Files to Modify

| File | Change |
|------|--------|
| `apps/mirror/features/articles/views/article-list-view.tsx` | Add conditional checkbox column in header |
| `apps/mirror/features/articles/components/article-list-item.tsx` | Add conditional checkbox cell with z-10 |
| `apps/mirror/features/articles/components/scrollable-article-list.tsx` | Add `useState` for articles, wire selection hook + toolbar + delete handler |
| `apps/mirror/features/articles/index.ts` | Export new components if needed |

## Implementation Order

1. `useArticleSelection` hook — pure logic, testable in isolation
2. `ArticleListView` + `ArticleListItem` — add checkbox column, verify z-10 overlay fix
3. `DeleteArticlesDialog` — pure view with props
4. `ArticleToolbar` — wires dialog trigger + disabled state
5. `ScrollableArticleList` — integrate all pieces, add mutable state + delete handler
6. Empty state — handle zero articles case
7. Verify on both desktop and mobile layouts

## References

### Internal

- ProfileContext: `apps/mirror/features/profile/context/profile-context.tsx`
- Article list: `apps/mirror/features/articles/views/article-list-view.tsx`
- Article item: `apps/mirror/features/articles/components/article-list-item.tsx`
- Scrollable list: `apps/mirror/features/articles/components/scrollable-article-list.tsx`
- AlertDialog pattern: `apps/greyboard/app/(protected)/dashboard/tasks/_components/tasks-header-actions.tsx`
- Table primitives: `packages/ui/src/primitives/table.tsx`
- Checkbox primitive: `packages/ui/src/primitives/checkbox.tsx`
- AlertDialog primitive: `packages/ui/src/primitives/alert-dialog.tsx`
- Icon component: `packages/ui/src/components/icon.tsx`
- TrashFillIcon: `packages/icons/src/components/trash-fill.tsx`
