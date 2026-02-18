# Folder Structure Convention

> Canonical source: `docs/conventions/file-organization-convention.md`

This rule defers to the living convention document. See that file for:

- Route layer rules (`app/**/_components/` only for new code)
- Feature module structure (`features/<feature>/`)
- Cross-app feature packages (`packages/features/<feature>/`)
- Import boundaries
- Decision tree for file placement
- Migration direction for each app

Key highlights:

- **Only `_components/`** for new route-private code (no `_hooks/`, `_utils/`, `_views/`, `_data/`)
- **Feature-first** organization: `features/<feature>/{components,hooks,store,types,utils,lib,views}/`
- **Promotion ladder**: route-level → app-level → package-level
