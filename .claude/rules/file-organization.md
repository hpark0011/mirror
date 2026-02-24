# File Organization Convention

> Full rules: `docs/conventions/file-organization-convention.md`

## components/ vs views/

**All React components go in `components/`.** Do NOT create `views/` in app-level feature modules.
`views/` is only for cross-app packages (`packages/features/<feature>/views/`) — the pure-UI layer.

## Component naming suffixes

| Suffix | Meaning | Example |
|--------|---------|---------|
| `-connector.tsx` | Reads context/hooks, delegates to a UI component. No markup of its own. | `article-list-toolbar-connector.tsx` |
| *(none)* | Everything else — UI, presentational, interactive, dialogs. | `article-list-toolbar.tsx` |

## Feature file placement

| File type                    | Directory              |
| ---------------------------- | ---------------------- |
| React component (any kind)   | `components/`          |
| Custom hook                  | `hooks/`               |
| Context provider             | `context/`             |
| Types/interfaces             | `types/` or co-located |
| Utility functions            | `utils/`               |
| Adapters, schemas, mock data | `lib/`                 |
| State store                  | `store/`               |
