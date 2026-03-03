# File Organization Convention (Living Document)

Last updated: 2026-02-19
Status: active  
Scope: all apps and shared packages in this monorepo

## Why

This convention makes file placement predictable by separating:

1. Route entrypoints
1. Generic shared components
1. Feature-specific code
1. Cross-app reusable features

## Core Rules

### 1) Route Layer (`app/**`)

Allowed in route folders:

1. Next.js route files: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`, `route.ts`
1. Route-local private components: `app/**/_components/*`

Disallowed for new code in route folders:

1. `_hooks`
1. `_utils`
1. `_data`
1. `_view`
1. `_views`

### 2) Generic Shared Components (`components/**`)

Use `components/` for app-level generic components reused across multiple features/routes in the same app.

Examples:

- providers/wrappers used across many routes
- generic navigation/header/footer pieces
- pure shared UI composition not tied to one domain feature

### 3) Feature Modules (`features/<feature>/**`)

All feature-specific code lives in a feature folder:

```text
features/<feature>/
  components/    # All React components (pure UI, connectors, dialogs, etc.)
  hooks/         # Custom hooks
  context/       # Context providers and consumers
  store/         # Zustand or other state stores
  types/         # TypeScript types/interfaces
  utils/         # Utility functions
  lib/           # Data access (queries, mutations, adapters), schemas, mock data
  index.ts       # Public exports
```

Use only the folders needed by that feature.

#### Where React components go

**All React components go in `components/`.** This includes:

- Pure presentational components (receive all data via props)
- Context-reading connectors (read context/hooks and pass to children)
- Dialogs, modals, dropdowns
- Composition wrappers

Do **not** create a `views/` directory in app-level feature modules. The `components/` + hooks separation already provides logic/UI decoupling. Adding a second directory creates an ambiguous placement decision that AI agents consistently get wrong.

#### Component naming suffixes

| Suffix | Meaning | Example |
|--------|---------|---------|
| `-connector.tsx` | Reads context/hooks and delegates to a UI component. No markup of its own beyond the child it renders. | `article-list-toolbar-connector.tsx` |
| *(none)* | Everything else — UI, presentational, interactive, dialogs, dropdowns. Use a descriptive name. | `article-list-toolbar.tsx`, `delete-articles-dialog.tsx` |

The `-connector` suffix is **required** when a component exists solely to bridge context to props. This makes context subscription boundaries visible at a glance and prevents agents from mixing context reads into UI components.

Do not use a `-view` suffix for new files. It doesn't carry information that distinguishes it from any other props-receiving component.

#### `views/` in cross-app packages only

The `views/` directory is appropriate in `packages/features/<feature>/` where it represents a package API layer — the customizable pure-UI boundary that consuming apps can swap out. Example: `packages/features/auth/views/` exports pure UI forms that apps wire up with their own hooks.

Naming:

1. Use `lib/` (singular) for data access (queries, mutations, adapters), schemas, mock data.
1. Keep feature public exports in `index.ts`.

### 4) Cross-App Features (`packages/features/<feature>/**`)

If a feature is reused across apps, move it to `packages/features`.

Promotion triggers:

1. Used by 2+ apps
1. Shared product behavior/UI contract
1. App-agnostic business logic that should be versioned centrally

## Import Boundaries

1. `app/**` can import from:
   - `@/features/*`
   - `@/components/*`
   - `@feel-good/features/*`
1. `features/**` must not import from `app/**`.
1. `components/**` should avoid importing from `app/**`.

## Decision Tree

1. Is it specific to one feature domain?
   Place in `features/<feature>/...`
1. Is it only UI glue for one route segment?
   Place in `app/<route>/_components/...`
1. Is it generic within one app?
   Place in `components/...`
1. Is it shared across apps?
   Place in `packages/features/<feature>/...`

### Feature file placement (for AI agents)

Within a feature module, placement is mechanical — one answer per file type:

| File type | Directory |
|-----------|-----------|
| React component (any kind) | `components/` |
| Custom hook | `hooks/` |
| Context provider | `context/` |
| Types/interfaces | `types/` or co-located |
| Utility functions | `utils/` |
| Data access, adapters, schemas, mock data | `lib/` |
| State store | `store/` |

## Current Migration Direction

### Mirror

Move current route-local feature logic from:

- `app/_view/*`
- `app/(protected)/dashboard/_view/*`
- `app/(protected)/dashboard/articles/_hooks/*`
- `app/(protected)/dashboard/articles/_data/*`
- `app/(protected)/dashboard/articles/_view/*`

into:

- `features/home/components/*`
- `features/profile/components/*`
- `features/articles/components/*`
- `features/articles/hooks/*`
- `features/articles/lib/*`

Keep route-only composition pieces in `app/**/_components`.

Note: `views/` directories in Mirror features have been merged into `components/`. See `docs/2026-02-19-report-file-organization-consistency.md` for the full rationale.

### Greyboard

Continue feature-first organization under `apps/greyboard/features/**`; gradually reduce route-local `_hooks/_utils/_views` where logic is stable and reusable in feature modules.

### UI Factory

Treat route demo pages as route entrypoints and keep only route-local composition wrappers there. Move reusable demo logic/UI into `features/**` when it becomes app-wide or cross-app relevant.

## Legacy Note

Existing `_view` / `_views` route directories are legacy and should be migrated opportunistically. Do not add new ones.

## Change Log

1. 2026-02-19: Added `-connector.tsx` naming convention for context-bridging components. Deprecated `-view` suffix for new files. Completed Mirror `views/` → `components/` migration.
1. 2026-02-19: Removed `views/` from app-level feature module template. All React components go in `components/`. `views/` is reserved for cross-app packages where it defines a package API boundary. Added mechanical placement table for AI agents.
1. 2026-02-09: Adopted repo-wide feature-first placement with `app/**/_components` as the only route-private folder pattern for new code.
1. 2026-03-02: Clarified `lib/` purpose — data access (queries, mutations, adapters), not generic utilities.
