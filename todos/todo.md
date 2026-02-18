# Session Plans

# 2026-02-12 Mirror Article List Filter

- [x] Confirm filter behavior contract (date presets, root filter-search behavior, default states)
- [ ] Implement `use-article-filters` hook and pure filter helpers for category/date/published
- [ ] Build `ArticleFilterDropdown` with root search input (`placeholder="filter by..."`) and submenu triggers (`category`, `published date`, `created at date`, `published state`)
- [ ] Implement category submenu with Greyboard project-filter structure: search input, selected badges with remove actions, and multi-select checkbox items
- [ ] Implement `published date` submenu (single-select)
- [ ] Gate `created at date` submenu visibility to profile owner only
- [ ] Gate `published state` submenu visibility to profile owner only
- [ ] Integrate filter state into `ScrollableArticleList` so filters compose with existing sort/search/pagination
- [ ] Replace toolbar placeholder filter button with active-aware trigger state
- [ ] Keep root `filter by...` input scoped to narrowing dropdown filter options only (must not directly filter article list)
- [ ] Verify keyboard and focus behavior (input key handling, submenu interactions, no accidental close on multi-select actions)
- [ ] Run verification (`pnpm --filter @feel-good/mirror lint` and `pnpm --filter @feel-good/mirror exec tsc --noEmit`)
- [ ] Add review notes with behavior validation and any edge-case findings

## Architecture Decision

- Use `DropdownMenu` as the primary container for this feature.
- Reason: requirements explicitly call for nested submenu triggers (`category`, `published date`, `created at date`, `published state`), which map directly to `DropdownMenuSub*`.
- `Popover` is still a good fit for a single-panel filter (as in Greyboard), but with required submenus it adds custom nested overlay/focus work without clear upside.
- Reuse the interaction model from Greyboard's project filter for the category submenu internals, adapted to dropdown event behavior.

## Proposed Filter Model

- `categories: string[]` (multi-select)
- `publishedDate: "all" | "last7Days" | "last30Days" | "thisYear"` (single-select)
- `createdAtDate: "all" | "last7Days" | "last30Days" | "thisYear"` (single-select, owner only)
- `publishedState: "all" | "published" | "draft"` (single-select, owner only)
- `hasActiveFilters: boolean` derived from non-default state for trigger styling

## Confirmed Requirements

- Replace single date submenu with two date submenus: `published date` and `created at date`.
- `created at date` submenu is visible only to the profile owner.
- Root `filter by...` input only narrows dropdown filter options and does not directly filter article list rows.

## Review

- Planning updated with confirmed requirements. Waiting for implementation approval.
