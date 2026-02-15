---
status: completed
priority: p2
issue_id: "183"
tags: [documentation, claude-rules, mirror, articles, context-guardian]
dependencies: []
---

# Create Mirror Articles Rules File

## Problem Statement

Mirror is the most actively developed app (65 commits in last 2 weeks) but has no app-specific `.claude/rules/` — unlike greyboard which has `.claude/rules/apps/greyboard/` with `features.md` and `hooks.md`. The articles feature has grown to 34 files with established architectural patterns that should be documented as rules for consistent future development.

## Findings

- **Greyboard has rules:** `.claude/rules/apps/greyboard/features.md`, `.claude/rules/apps/greyboard/hooks.md`
- **Mirror has none** despite being the dominant app in active development
- Articles feature has clear, stable patterns established across PR #119–#122:
  - Workspace context architecture (provider wraps toolbar + list + scroll-root contexts)
  - Toolbar / content separation via workspace layout slots
  - Filter composition (DropdownMenu with DropdownMenuSub for nested categories)
  - Feature folder structure as canonical example

## Proposed Solution

Create `.claude/rules/apps/mirror/articles.md` documenting:

### Workspace Context Architecture
- `ArticleWorkspaceProvider` — root provider composing toolbar + list + scroll-root contexts
- `ArticleToolbarContext` — owner state, sort, search, filter, categories, selection count, delete
- `ArticleListContext` — articles, pagination, username, selection, animation, empty state
- `ScrollRootContext` — scroll container ref for virtualized list
- Consumers import from focused contexts to avoid cross-concern re-renders

### Component Organization
```
features/articles/
  components/          # Interactive components with state
    filter/            # Filter submenu components (6 files)
  context/             # React contexts (4 files)
  hooks/               # Feature hooks (5: filter, pagination, search, selection, sort)
  utils/               # Pure utilities (filter logic, config, date presets)
  views/               # Presentational components (detail, list, toolbar, dialog)
  lib/                 # Data layer (mock data, formatters)
  index.ts             # Public API
```

### Toolbar / Content Separation
- Toolbar components render into `WorkspaceToolbarSlot` via workspace layout
- Content components render in main content area
- State flows through separate contexts

### Filter Pattern
- `DropdownMenu` with `DropdownMenuSub` for nested categories
- Category: multi-select with search, badges, checkboxes
- Date presets: single-select (all, last 7 days, last 30 days, this year)
- Status: single-select (all, published, draft) — owner only

## Acceptance Criteria

- [x] `.claude/rules/apps/mirror/articles.md` exists with `paths` frontmatter targeting `apps/mirror/features/articles/**`
- [x] Documents workspace context architecture
- [x] Documents component organization
- [x] Documents toolbar/content separation pattern
- [x] Documents filter composition pattern

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-13 | Created from context guardian audit | Mirror has no rules despite being most active app |
| 2026-02-13 | Created `.claude/rules/apps/mirror/articles.md` | 34-file feature with nested context + filter composition patterns documented |
