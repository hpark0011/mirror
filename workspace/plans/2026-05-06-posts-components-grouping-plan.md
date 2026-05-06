# Plan — Group `features/posts/components/` by surface

**Date:** 2026-05-06
**Branch:** `refactor-post-files`
**Scope:** `apps/mirror/features/posts/components/` reorg only — no behavior changes.

---

## Goal

19 files at the top level of `apps/mirror/features/posts/components/` is past the point where scanning helps, and the sibling `articles` feature has already been grouped into `list/ | detail/ | editor/`. Mirror that layout for posts so the two features have the same shape and a new contributor can find any file by surface.

This plan touches only file locations and import paths. Component bodies, props, exported names, public surface (`features/posts/index.ts` named exports), and the three post routes (`/posts`, `/posts/:slug`, `/posts/:slug/edit`) stay byte-equivalent to today.

---

## Final mapping

### `components/list/` (11 files)

The post browsing surface — list rendering, toolbar, category filter row, plus the markdown-import flow triggered from the list toolbar.

- `post-list-item.tsx`
- `post-list-toolbar.tsx`
- `post-list-toolbar-connector.tsx`
- `scrollable-post-list.tsx`
- `post-category-filter-row.tsx`
- `markdown-upload-dialog.tsx`
- `markdown-upload-dialog-connector.tsx`
- `markdown-file-input.tsx`
- `parsed-metadata-preview.tsx`
- `import-result-status.tsx`
- `cover-image-picker.tsx`

> Posts has only one filter sub-component (`post-category-filter-row.tsx`), so unlike articles it stays flat under `list/` rather than nested in `list/filter/`. Promote to `list/filter/` if more filter pieces appear.

### `components/detail/` (7 files)

Read view + the publish toggle that lives in the detail toolbar.

- `post-detail.tsx`
- `post-detail-connector.tsx`
- `post-detail-toolbar.tsx`
- `post-detail-loading.tsx`
- `post-metadata.tsx`
- `publish-toggle.tsx`
- `publish-toggle-connector.tsx`

> Articles' publish toggle lives in `editor/` because publishing is wired into the article metadata-header. Posts wires publishing into the **detail toolbar** (`post-detail-toolbar.tsx` → `publish-toggle-connector.tsx`), so the publish-toggle pair belongs in `detail/` for posts. Not a deviation — different feature, different surface.

### `components/editor/` (1 file)

- `post-editor.tsx`

> Posts has no metadata-header / new-editor / cover-picker peers in its editor (the post edit page just renders the shared `ContentEditor` from `features/content`). One file is intentional, not a placeholder.

### Open decision — `post-metadata.tsx` placement

`post-metadata.tsx` is imported by **both** `post-detail.tsx` (detail) and `post-list-item.tsx` (list). Two options:

- **(a) `detail/post-metadata.tsx` with cross-sibling import.** `list/post-list-item.tsx` reaches across with `../detail/post-metadata`. **Recommended.** Matches the articles convention of strict subfolder grouping (no top-level shared files in `components/`). One small, stable, presentational file shared via cross-sibling import is acceptable.
- **(b) Top-level `components/post-metadata.tsx`.** Skips the cross-sibling import but introduces a third placement category alongside list/detail/editor. Deviates from articles.

This plan assumes **(a)**. If the user prefers **(b)**, swap step 2 below to leave `post-metadata.tsx` at the top level and update only `list/post-list-item.tsx`'s `./post-metadata` to `../post-metadata` and `detail/post-detail.tsx`'s `./post-metadata` to `../post-metadata`.

### Cross-group sibling imports — exactly one

After the move, every `./<sibling>` relative import resolves inside the same target group EXCEPT one:

| File (after move) | Cross-group sibling import |
|---|---|
| `list/post-list-item.tsx` | `../detail/post-metadata` (was `./post-metadata`) |

All other internal sibling imports stay valid (and stay `./<sibling>`) because the importer and importee move into the same group together — see the table in § "Implementation steps" for the per-group breakdown.

---

## Internal relative-path rewrites required

Every moved file uses `../types`, `../hooks/...`, or `../context/...` against the current `components/` location. Each path needs one extra `../`:

| Old (from `components/<file>.tsx`) | New (from `components/<group>/<file>.tsx`) |
|---|---|
| `../types` | `../../types` |
| `../hooks/...` | `../../hooks/...` |
| `../context/...` | `../../context/...` |

This differs from the articles reorg's plan-level claim of "no internal edits needed" — that claim was wrong; the merged article files are using `../../types`, `../../hooks`, `../../context`, `../../utils`, `../../lib` as expected. Posts uses the same pattern, so the same rewrite applies. **Don't trust the articles plan's wording on this point — trust the file contents.**

Per-file occurrences (from `grep -n "from \"\\.\\./" components/`):

| File | `../` paths to bump |
|---|---|
| `import-result-status.tsx` | `../hooks/use-create-post-from-file` |
| `post-detail.tsx` | `../types` |
| `post-list-toolbar.tsx` | `../types`, `../hooks/use-post-filter` |
| `scrollable-post-list.tsx` | `../context/post-list-context` |
| `markdown-upload-dialog-connector.tsx` | `../context/post-toolbar-context`, `../hooks/use-markdown-file-parser`, `../hooks/use-create-post-from-file`, `../hooks/use-cover-image-state` |
| `markdown-upload-dialog.tsx` | `../hooks/use-markdown-file-parser`, `../hooks/use-create-post-from-file` |
| `post-detail-toolbar.tsx` | `../types` |
| `post-list-item.tsx` | `../types` |
| `post-list-toolbar-connector.tsx` | `../context/post-toolbar-context` |
| `parsed-metadata-preview.tsx` | `../hooks/use-markdown-file-parser` |
| `publish-toggle-connector.tsx` | `../hooks/use-publish-toggle`, `../types` |
| `post-detail-connector.tsx` | `../types` |
| `publish-toggle.tsx` | `../types` |
| `post-metadata.tsx` | `../types` |
| `post-editor.tsx` | `../hooks/use-post-inline-image-upload`, `../types` |

Files with no `../` imports (pure-UI): `cover-image-picker.tsx`, `markdown-file-input.tsx`, `post-category-filter-row.tsx`, `post-detail-loading.tsx`. No rewrites needed in those.

---

## External import sites that must change

Found via `grep -rln "@/features/posts" apps/ packages/` (excluding `.next/cache`):

1. **`apps/mirror/features/posts/index.ts`** — 8 component re-exports:
   - `./components/post-list-toolbar-connector` → `./components/list/post-list-toolbar-connector`
   - `./components/post-list-toolbar` → `./components/list/post-list-toolbar`
   - `./components/scrollable-post-list` → `./components/list/scrollable-post-list`
   - `./components/post-detail` → `./components/detail/post-detail`
   - `./components/post-detail-toolbar` → `./components/detail/post-detail-toolbar`
   - `./components/post-detail-connector` → `./components/detail/post-detail-connector`
   - `./components/post-detail-loading` → `./components/detail/post-detail-loading`
   - (`PostWorkspaceProvider` re-export from `./context/post-workspace-context` and the `PostSummary` type re-export from `./types` are unchanged.)

2. **`apps/mirror/app/[username]/@content/posts/[slug]/edit/page.tsx`**:
   - `@/features/posts/components/post-editor` → `@/features/posts/components/editor/post-editor`

3. **`apps/mirror/features/posts/__tests__/publish-toggle.test.tsx`**:
   - `vi.mock("@/features/posts/components/publish-toggle", ...)` → `vi.mock("@/features/posts/components/detail/publish-toggle", ...)`

4. **`apps/mirror/features/posts/__tests__/publish-toggle-connector.test.tsx`**:
   - `vi.mock("@/features/posts/components/publish-toggle", ...)` → `vi.mock("@/features/posts/components/detail/publish-toggle", ...)`
   - `vi.mock("@/features/posts/components/publish-toggle-connector", ...)` → `vi.mock("@/features/posts/components/detail/publish-toggle-connector", ...)`

The other four external consumers (`@content/posts/page.tsx`, `@content/posts/layout.tsx`, `@content/posts/[slug]/page.tsx`, `@content/posts/[slug]/loading.tsx`) all import from the `@/features/posts` barrel — they need no edits because the barrel updates its own paths.

The public barrel surface (`features/posts/index.ts` named exports) is **unchanged**.

---

## Implementation steps (in order)

1. **Create the three subfolders** under `apps/mirror/features/posts/components/`:
   - `list/`
   - `detail/`
   - `editor/`

2. **Move files with `git mv`** so blame/history follows. Use the exact mapping above. One mv per file (or batch per group).

3. **Patch internal relative-path imports** per the table in § "Internal relative-path rewrites required". 15 files need `../` → `../../` edits; 4 files need none.

4. **Apply the one cross-sibling fix** in `list/post-list-item.tsx`: `./post-metadata` → `../detail/post-metadata`.

5. **Update the four external import sites** listed in § "External import sites that must change". Order doesn't matter; the build at step 6 will catch any miss.

6. **Tier 2 verification first** (`pnpm build --filter=@feel-good/mirror` then `pnpm lint --filter=@feel-good/mirror`). Fix any TS-resolution misses surfaced by the build before moving on. The build is the safety net for any import grep didn't pick up.

7. **Run unit tests** — `pnpm test:unit --filter=@feel-good/mirror`. The two `publish-toggle*.test.tsx` specs are the canary for the `vi.mock()` path updates.

8. **Run hard-verification Playwright suite** (see § Hard verification).

9. **Run `graphify update .`** to refresh the knowledge graph with the new file locations (per `CLAUDE.md`).

---

## Hard verification — Playwright CLI

Per `.claude/rules/verification.md`: Playwright CLI only, never Playwright MCP.

**Command:**

```bash
pnpm --filter=@feel-good/mirror test:e2e -- \
  e2e/post-upload.authenticated.spec.ts \
  e2e/post-publish-toggle.authenticated.spec.ts \
  e2e/post-inline-image-paste.authenticated.spec.ts
```

**Why these three specs (one per surface):**

- **`e2e/post-upload.authenticated.spec.ts`** exercises the **list** surface and the markdown-import flow — five list/* files (the markdown-upload-dialog cluster + cover-image-picker + parsed-metadata-preview + import-result-status + markdown-file-input) all live or die by this test. Pinned assertion: dialog visibility on toolbar click — `await expect(dialog.getByText("Import Markdown")).toBeVisible()` (line 67).
- **`e2e/post-publish-toggle.authenticated.spec.ts`** exercises the **detail** surface — covers `post-detail-toolbar` → `publish-toggle-connector` → `publish-toggle`, plus `post-metadata` (the `post-status-label` testid lives in `post-metadata.tsx`). Pinned assertion: `await expect(page.getByTestId("post-status-label")).toBeVisible()` (line 56).
- **`e2e/post-inline-image-paste.authenticated.spec.ts`** exercises the **editor** surface — the only `post-editor.tsx` consumer route, and the test is the cleanest proof the editor still mounts after the move. Pinned assertion: `await expect(page.getByTestId("save-post-btn")).toBeVisible()` (line 59).

**Pass criteria:**

1. All three specs exit 0.
2. Build is clean: `pnpm build --filter=@feel-good/mirror` exits 0 with no `Cannot find module` errors mentioning `features/posts/components/...`.
3. Lint is clean: `pnpm lint --filter=@feel-good/mirror` exits 0.
4. Unit tests pass: `pnpm test:unit --filter=@feel-good/mirror` exits 0 — the two `publish-toggle*.test.tsx` specs are the canary for the `vi.mock()` path updates.

**Fallback if a Playwright spec already fails on `main`** (i.e., the failure is unrelated to this refactor): do not paper over it. Stop, report the unrelated failure, and ask whether to proceed with a narrower spec or fix the upstream issue first. Do not silence specs to make the refactor look clean.

---

## Constraints & non-goals

- **No behavior changes.** Component bodies are not edited. Props and exported names are unchanged. The public barrel (`features/posts/index.ts`) keeps the same exported symbols.
- **No new abstractions.** No re-export `index.ts` files inside the new subfolders. Importers reach files directly (`@/features/posts/components/editor/post-editor`), matching the articles convention.
- **No changes outside `apps/mirror/features/posts/components/`** — except for the four external import sites listed above. If grep surfaces a fifth, stop and re-plan rather than expanding scope mid-move.
- **`git mv` is required** so blame/history follows. A `mv` + `git add` would orphan history.
- **Worktree path discipline.** This work runs in `/Users/disquiet/Desktop/mirror/.worktrees/refactor-post-files/`. Every Edit/Write must use the worktree's absolute path — sub-agent reports that name a main-repo path are a trap.
- **Branch rule.** Per `AGENTS.md`, no direct commits to `main`. Already on `refactor-post-files`.
- **Out of scope for this plan**, but worth flagging if the user wants follow-ups:
  - Renaming individual files (e.g., dropping the redundant `post-` prefix once everything is in `posts/components/<group>/`).
  - Splitting components that exceed 100 lines (per `react-components.md`) — that's a content change, not a reorg. `post-list-toolbar.tsx` (2686 bytes), `post-list-item.tsx` (3338 bytes), `markdown-upload-dialog-connector.tsx` (3044 bytes), and `markdown-upload-dialog.tsx` (2913 bytes) are the candidates if you want to look later.
  - Adding a `.claude/rules/apps/mirror/posts.md` mirror of `articles.md` to document placement / naming conventions for posts. Worth doing but optional, and best as a separate commit after the move is verified.

---

## Risk + reversibility

- **Reversibility:** `git mv` is fully reversible via `git restore` or branch reset before merge. No DB/data changes. No env changes.
- **Blast radius:** Local to one app's one feature. No public API contract drift.
- **Highest-risk failure mode:** A missed import site in a file the grep didn't pick up (e.g., a `.tsx` that uses a non-standard quoting style). Mitigation: `pnpm build --filter=@feel-good/mirror` catches every TS-resolved import; the build is the safety net.
- **Second-highest risk:** Forgetting the `../` → `../../` rewrites because the articles plan claimed they weren't needed. They were. The build will fail loudly with `Cannot find module '../types'` if missed — that's the canary.
- **Third-highest risk:** The cross-sibling `list/post-list-item.tsx → ../detail/post-metadata` import is forgotten and stays as `./post-metadata`. The build catches this too.
