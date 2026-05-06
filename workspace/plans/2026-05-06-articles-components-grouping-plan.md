# Plan — Group `features/articles/components/` by surface

**Date:** 2026-05-06
**Branch:** `improvements-article-editor`
**Scope:** `apps/mirror/features/articles/components/` reorg only — no behavior changes.

---

## Goal

22 files at the top level of `apps/mirror/features/articles/components/` is past the point where scanning helps. There is already precedent (`components/filter/`). Group the top-level files into three sibling subfolders that mirror the three surfaces of the feature: **list**, **detail**, **editor**. Move the existing `filter/` subfolder under `list/filter/` because filter is a list-only concern. Update every import site so the build, lint, unit tests, and existing Playwright e2e tests pass with no behavior change.

This plan touches only file locations and import paths. Component logic, props, exports, public surface (`features/articles/index.ts` named exports), and the four article routes (`/articles`, `/articles/:slug`, `/articles/:slug/edit`, `/articles/new`) stay byte-equivalent to today.

---

## Final mapping

### `components/list/` (11 files + nested `filter/`)

The article browsing surface — list rendering, toolbar, search, sort, filter dropdown, delete dialog.

- `animated-article-row.tsx`
- `article-filter-dropdown.tsx`
- `article-list-item.tsx`
- `article-list-loader.tsx`
- `article-list-toolbar-connector.tsx`
- `article-list-toolbar.tsx`
- `article-list.tsx`
- `article-search-input.tsx`
- `article-sort-dropdown.tsx`
- `delete-articles-dialog.tsx`
- `scrollable-article-list.tsx`
- `filter/` (entire subfolder — 6 files — moves verbatim under `list/`)

### `components/detail/` (3 files)

Read view + its toolbar + loading state.

- `article-detail.tsx`
- `article-detail-loading.tsx`
- `article-detail-toolbar.tsx`

### `components/editor/` (7 files)

Write surface — shell, toolbar, metadata header, cover picker, publish toggle, plus the two entry components that wrap `ArticleEditorShell`.

- `article-editor.tsx`
- `article-editor-shell.tsx`
- `article-editor-toolbar.tsx`
- `article-metadata-header.tsx`
- `article-publish-toggle.tsx`
- `cover-image-picker.tsx`
- `new-article-editor.tsx`

### Tests folder

- `components/__tests__/article-metadata-header.test.tsx` stays at `components/__tests__/` (vitest path, not file-organization concern). Its `@/features/articles/components/article-metadata-header` import is updated to `@/features/articles/components/editor/article-metadata-header`.

### Cross-group imports — none

All 16 internal sibling imports surfaced by `grep "from \"\\./" components/` resolve inside their own target group:

| File (after move) | Sibling imports | All within same group? |
|---|---|---|
| `editor/article-editor-shell.tsx` | `./article-editor-toolbar`, `./article-metadata-header` | yes (editor) |
| `editor/article-editor-toolbar.tsx` | `./article-publish-toggle` | yes (editor) |
| `editor/article-metadata-header.tsx` | `./cover-image-picker` | yes (editor) |
| `editor/article-editor.tsx` | `./article-editor-shell` | yes (editor) |
| `editor/new-article-editor.tsx` | `./article-editor-shell` | yes (editor) |
| `list/article-list-item.tsx` | `./animated-article-row` | yes (list) |
| `list/article-list-toolbar-connector.tsx` | `./article-list-toolbar` | yes (list) |
| `list/article-list-toolbar.tsx` | `./article-filter-dropdown`, `./article-search-input`, `./article-sort-dropdown`, `./delete-articles-dialog` | yes (list) |
| `list/scrollable-article-list.tsx` | `./article-list` | yes (list) |
| `list/filter/category-filter-content.tsx` | `./category-filter-search`, `./category-filter-badges`, `./category-filter-list` | yes (list/filter) |

So every `./sibling` relative import stays valid as-is after each file moves into its target folder. No import-rewrites are needed *inside* the moved files (the relative paths resolve identically). The only rewrites are at **external** import sites.

---

## Import sites that must change

Found via `grep -rln "features/articles/components" apps/ packages/` (excluding `.next/cache`):

1. **`apps/mirror/features/articles/index.ts`** — 5 component re-exports:
   - `./components/scrollable-article-list` → `./components/list/scrollable-article-list`
   - `./components/article-detail-loading` → `./components/detail/article-detail-loading`
   - `./components/article-detail` → `./components/detail/article-detail`
   - `./components/article-list-toolbar-connector` → `./components/list/article-list-toolbar-connector`
   - `./components/article-detail-toolbar` → `./components/detail/article-detail-toolbar`

2. **`apps/mirror/app/[username]/@content/articles/new/page.tsx`**:
   - `@/features/articles/components/new-article-editor` → `@/features/articles/components/editor/new-article-editor`

3. **`apps/mirror/app/[username]/@content/articles/[slug]/edit/page.tsx`**:
   - `@/features/articles/components/article-editor` → `@/features/articles/components/editor/article-editor`

4. **`apps/mirror/features/articles/components/__tests__/article-metadata-header.test.tsx`**:
   - `@/features/articles/components/article-metadata-header` → `@/features/articles/components/editor/article-metadata-header`

External public surface (`features/articles/index.ts` named exports) is **unchanged** — only the internal relative paths inside `index.ts` move. Any consumer that imports from `@/features/articles` (the barrel) needs no edit.

---

## Implementation steps (in order)

1. **Create the three subfolders** under `apps/mirror/features/articles/components/`:
   - `list/`
   - `detail/`
   - `editor/`

2. **Move files with `git mv`** so history follows. One mv per file (or batched per group). Move `filter/` subfolder into `list/filter/` as a single directory rename. Use the exact mapping above.

3. **Update the 4 external import sites** listed in the previous section. No internal relative-path edits needed (verified by grep — every sibling import resolves identically inside the new folder).

4. **Run Tier 2 verification first** (`pnpm build --filter=@feel-good/mirror` then `pnpm lint --filter=@feel-good/mirror`). Fix any TS-resolution misses surfaced by the build before moving on.

5. **Run unit tests** — `pnpm test:unit --filter=@feel-good/mirror`. The metadata-header vitest spec is the canary for the test-file path update.

6. **Run hard-verification Playwright suite** (see § Hard verification).

7. **Run `graphify update .`** to refresh the knowledge graph with the new file locations (per `CLAUDE.md`).

---

## Hard verification — Playwright CLI

Per `.claude/rules/verification.md`: Playwright CLI only, never Playwright MCP.

**Command:**

```bash
pnpm --filter=@feel-good/mirror test:e2e -- \
  e2e/article-navigation.spec.ts \
  e2e/article-editor.authenticated.spec.ts
```

**Why these two specs:**

- `e2e/article-navigation.spec.ts` exercises the **list** surface — hits `/@username/articles`, opens the search bar, navigates into a detail view, and asserts the back-to-list flow. Pinned route assertions: `await expect(page).toHaveURL(new RegExp(\`/@${username}/articles(\\?.*)?$\`))` (line ~165), and the no-results empty-state copy at line ~203 (`"No articles match your search and filters"`).
- `e2e/article-editor.authenticated.spec.ts` exercises the **editor** surface — the most-rewired group (4 import-site changes touch editor entry points).

**Pass criteria:**

1. Both specs exit 0.
2. Build is clean: `pnpm build --filter=@feel-good/mirror` exits 0 with no `Cannot find module` errors mentioning `features/articles/components/...`.
3. Lint is clean: `pnpm lint --filter=@feel-good/mirror` exits 0.
4. Unit tests pass: `pnpm test:unit --filter=@feel-good/mirror` exits 0 (the article-metadata-header vitest spec is the canary for the test-file path update).
5. The article list still renders rows and the editor still mounts at `/@username/articles/:slug/edit` and `/@username/articles/new` — both confirmed by the Playwright specs above, not by visual inspection.

**Fallback if a Playwright spec already fails on `main`** (i.e., the failure is unrelated to this refactor): do not paper over it. Stop, report the unrelated failure, and ask whether to proceed with a narrower spec or fix the upstream issue first. Do not silence specs to make the refactor look clean.

---

## Constraints & non-goals

- **No behavior changes.** Component bodies are not edited. Props and exported names are unchanged. The public barrel (`features/articles/index.ts`) keeps the same exported symbols.
- **No new abstractions.** No re-export `index.ts` files inside the new subfolders. Importers reach files directly (`@/features/articles/components/editor/article-editor`), matching how `components/filter/` is consumed today.
- **No changes outside `apps/mirror/features/articles/components/`** — except for the four external import sites listed above. If grep surfaces a fifth, stop and re-plan rather than expanding scope mid-move.
- **`git mv` is required** so blame/history follows. A `mv` + `git add` would orphan history.
- **Worktree path discipline.** This work runs in `/Users/disquiet/Desktop/mirror/.worktrees/improvements-article-editor/`. Every Edit/Write must use the worktree's absolute path — sub-agent reports that name a main-repo path are a trap (`apps/mirror/.env.local` is a symlink to main; component files are not, but the pattern still applies).
- **Branch rule.** Per `AGENTS.md`, no direct commits to `main`. Already on `improvements-article-editor`.
- **Out of scope for this plan**, but worth flagging if the user wants a follow-up:
  - Renaming individual files (e.g., dropping the redundant `article-` prefix once everything is in `articles/components/<group>/`).
  - Splitting components that exceed 100 lines (per `react-components.md`) — that's a content change, not a reorg.
  - Updating `.claude/rules/apps/mirror/articles.md` "Placement" section to mention the new sub-grouping. Worth doing but optional, and best as a tiny follow-up commit after the move is verified.

---

## Risk + reversibility

- **Reversibility:** `git mv` is fully reversible via `git restore` or branch reset before merge. No DB/data changes. No env changes.
- **Blast radius:** Local to one app's one feature. No public API contract drift.
- **Highest-risk failure mode:** A missed import site in a file the grep didn't pick up (e.g., a `.tsx` that uses a non-standard quoting). Mitigation: `pnpm build --filter=@feel-good/mirror` catches every TS-resolved import; the build is the safety net.
- **Second-highest risk:** `git mv` for the `filter/` directory rename ordering. Run `git mv components/filter components/list/filter` **after** `list/` exists but **before** moving the individual files into `list/` to avoid path-collision warnings.
