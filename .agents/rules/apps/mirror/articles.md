---
paths:
  - "apps/mirror/features/articles/**"
---

# Mirror Articles Feature Rules

Action-guiding rules for the articles feature. For architecture narrative (context layering, filter composition, component inventory), see `docs/features/mirror-articles-architecture.md`.

## Placement

- All React components live in `components/` (per `docs/conventions/file-organization-convention.md`).
- Filter sub-components go in `components/filter/`.
- Hooks in `hooks/`, context in `context/`, utils in `utils/`.

## Naming

- **Context connectors** use the `-connector.tsx` suffix and contain no markup beyond the child they render (e.g., `article-list-toolbar-connector.tsx` reads `useArticleToolbar()` and passes props to `article-list-toolbar.tsx`).
- Pure presentational components take no suffix — use a descriptive name (e.g., `article-list-toolbar.tsx`, `delete-articles-dialog.tsx`).

## Hooks

| Hook | Purpose | State Storage |
|------|---------|---------------|
| `useArticleSearch` | Search query + open state | Local |
| `useArticleSort` | Sort order | LocalStorage |
| `useArticleFilter` | Filter state | LocalStorage (`mirror.articles.filter`) |
| `useArticleSelection` | Multi-select checkboxes | Local |
| `useArticlePagination` | Pagination with loadMore | Local |

## Conventions

1. **Context usage**: Always consume via hooks (`useArticleToolbar`, `useArticleList`) — never access context directly.
2. **Props vs context**: Pure UI accepts props; containers/wrappers read context and pass as props.
3. **Memoization**: `ArticleWorkspaceProvider` memoizes toolbar and list context values to prevent unnecessary re-renders.
4. **Animation state**: `shouldAnimate` triggers briefly on sort change via timer (1000ms timeout).
5. **Selection clearing**: Auto-cleared when search opens or filters change (via `useEffect` in workspace provider).
6. **Scroll root**: Optional parameter passed to `ArticleListLoader` for `IntersectionObserver` root element.
7. **Empty states**: Computed from `hasNoArticles`, active search/filters, with contextual messages.
8. **Owner-only features**: Created-date filter, status filter, delete button, new button all check `isOwner`.
