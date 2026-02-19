---
title: "Markdown Document List"
type: feat
date: 2026-02-19
app: greyboard-desktop
---

# Markdown Document List

## Overview

Add folder selection and markdown file listing to Greyboard Desktop. Users select a folder, see all `.md` files in it, and can view their contents. This replaces the current board dashboard as the main view. The selected folder persists across app restarts.

**Phase 1 scope:** Select folder + list files + view file contents. Edit/create/delete deferred to Phase 2.

## Problem Statement / Motivation

Greyboard Desktop is being built as an issue ticket management tool for agentic development. The core interaction model is: point the app at a folder of markdown docs (plans, tickets, issues) and manage them. Before any Kanban board or editing features, the app needs the foundation — the ability to browse and read files from a user-selected directory.

## Proposed Solution

Extend the existing IPC system with three new operations: folder selection, file listing, and file reading. Replace the current board dashboard route with a document list view. Persist the selected folder in the main process (source of truth) and mirror it in the renderer's Zustand store for UI state.

### Security Model

The main process owns the folder path. The renderer never sends raw absolute paths — it sends relative file names only. The main process validates that resolved paths stay within the approved folder boundary.

```
Renderer                    Main Process
   │                            │
   │── selectFolder() ─────────►│  dialog.showOpenDialog({ directory })
   │◄── { path } ──────────────│  stores path internally
   │                            │
   │── listFiles() ────────────►│  reads stored path, scans directory
   │◄── [{ name, ... }] ───────│
   │                            │
   │── readFile({ name }) ─────►│  resolves name against stored path
   │◄── { content } ────────────│  validates path stays within folder
```

## Technical Approach

### IPC Channels (New)

Add to `electron/lib/channels.ts`:

```typescript
// Document management
DOCS_SELECT_FOLDER: 'greyboard:docs:selectFolder'   // Opens native folder picker, stores result
DOCS_GET_FOLDER: 'greyboard:docs:getFolder'          // Returns stored folder path (or null)
DOCS_LIST_FILES: 'greyboard:docs:listFiles'           // Scans stored folder for .md files
DOCS_READ_FILE: 'greyboard:docs:readFile'             // Reads a single .md file by name
```

### DesktopAPI Interface Additions

Add to `electron/lib/desktop-api.ts`:

```typescript
docs: {
  selectFolder: () => Promise<{ path: string } | null>
  getFolder: () => Promise<{ path: string } | null>
  listFiles: () => Promise<DocumentFile[]>
  readFile: (name: string) => Promise<{ name: string; content: string } | null>
}
```

### File List Entry Schema

```typescript
// DocumentFile
{
  name: string           // e.g. "001-feat-auth-plan.md"
  lastModified: string   // ISO 8601
  sizeBytes: number
}
```

### Zod Validators (New)

Add to `electron/lib/validators.ts`:

```typescript
readFilePayloadSchema   // { name: z.string().min(1).refine(no path separators) }
documentFileSchema      // { name, lastModified, sizeBytes }
documentFileListSchema  // z.array(documentFileSchema)
```

### IPC Handler: `electron/ipc/docs.ts`

New handler file following the pattern in `electron/ipc/files.ts`:

- **`selectFolder`**: Calls `dialog.showOpenDialog({ properties: ['openDirectory'] })`, stores the selected path in a module-level variable, returns `{ path }` or `null` on cancel.
- **`getFolder`**: Returns the currently stored folder path (or `null`). On app start, this is read from persistent storage (`electron-store` or a JSON file in `app.getPath('userData')`).
- **`listFiles`**: Reads the stored folder path, calls `readdir` with `withFileTypes: true`, filters for `.md` files (not symlinks, not hidden/dot-files), returns array of `{ name, lastModified, sizeBytes }` sorted alphabetically. Uses `stat()` for metadata.
- **`readFile`**: Validates the `name` payload with Zod (no `..`, no path separators), resolves against stored folder, verifies resolved path is still within the folder boundary (`resolvedPath.startsWith(folderPath)`), reads file with 10MB size limit, returns `{ name, content }`.

**Folder path persistence**: Use `electron-store` (already a dev dependency via `electron-updater` patterns) or write a simple JSON file to `app.getPath('userData')`. This keeps the approved folder path in the main process — it doesn't depend on the renderer's localStorage.

### Preload Bridge

Add the `docs` namespace to `electron/preload.ts`, mirroring the pattern for `files`, `app`, `notifications`, and `updates`.

### Renderer IPC Client

Add `docs` namespace to `src/lib/ipc/client.ts` with null-safe fallbacks (so the renderer can still run in a browser for debugging).

### State: Document Store

New Zustand store at `src/state/document-store.ts`:

```typescript
interface DocumentState {
  folderPath: string | null
  files: DocumentFile[]
  isLoading: boolean
}

interface DocumentActions {
  selectFolder: () => Promise<void>
  loadFolder: () => Promise<void>   // fetch stored folder + list files
  refreshFiles: () => Promise<void> // re-scan current folder
}
```

- Uses `persist` middleware for `folderPath` only (mirror of main process state)
- `loadFolder()` is called on mount: calls `desktopAPI.docs.getFolder()`, then `desktopAPI.docs.listFiles()`
- `selectFolder()` calls `desktopAPI.docs.selectFolder()`, then refreshes file list

### Router Changes

Update `src/router.tsx`:

```
/               → DocumentListPage (replaces Dashboard)
/document/:name → DocumentViewPage (new route)
```

### Components

#### `src/routes/document-list.tsx`

The main view (replaces `dashboard.tsx`). Three distinct states:

1. **No folder selected** (first launch): Empty state with illustration + "Select Folder" button
2. **Folder selected, has files**: Header showing folder name + "Change Folder" + "Refresh" buttons, then file list grid/table
3. **Folder selected, no `.md` files**: Empty state with "No markdown files found" + "Change Folder" button
4. **Folder path invalid** (deleted/moved): Error state with "Folder not found" + "Select New Folder" button

File list items show: file name (without `.md` extension), last modified date (relative, e.g. "2 days ago"), file size.

#### `src/routes/document-view.tsx`

Displays a single markdown file's content:

- Header: file name + back button to list
- Content: raw text in a `<pre>` or monospace-styled container (Phase 1 — rendered markdown deferred)
- Loading state while IPC reads the file
- Error state if file can't be read

### Dashboard Removal

- Delete `src/routes/dashboard.tsx`
- Remove `board-store.ts` and `src/lib/persistence/schema.ts` (board schema)
- Remove board-related IPC channels (`FILES_IMPORT_BOARD`, `FILES_EXPORT_BOARD`) and handlers from `electron/ipc/files.ts`
- Clean up unused imports

## Acceptance Criteria

- [x] User can click "Select Folder" and pick a directory via native OS dialog
- [x] After selecting a folder, all `.md` files (non-hidden, non-symlink, flat scan) are listed
- [x] Clicking a file shows its raw text content
- [x] Back button returns to the file list
- [x] Selected folder persists across app restart (main process storage)
- [x] Canceling the folder dialog preserves current state
- [x] Folder with no `.md` files shows appropriate empty state
- [x] Previously-deleted folder shows error state with re-select option
- [x] Manual "Refresh" button re-scans the current folder
- [x] File reading enforces 10MB size limit
- [x] Path traversal attempts (e.g., `../../etc/passwd`) are rejected by main process
- [x] Build passes: `pnpm build --filter=@feel-good/greyboard-desktop`
- [x] Type check passes: `pnpm check-types --filter=@feel-good/greyboard-desktop`

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Directory scan depth | Flat (top-level only) | Simpler, avoids performance issues, Phase 2 can add recursion |
| Markdown rendering | Raw text | No new dependency needed, rendered markdown in Phase 2 |
| Folder path storage | Main process (`electron-store` or userData JSON) | Security — main process is the trust boundary |
| File path IPC | Relative names only | Prevents path traversal from renderer |
| Symlinks | Excluded | Security — prevents accessing files outside selected folder |
| Hidden files | Excluded | Convention — dot-files are typically not user documents |
| Sort order | Alphabetical ascending | Simple, predictable default |
| File extensions | `.md` only | Per spec — `.markdown`, `.mdx` deferred |
| File list refresh | Manual button | Simpler than file watcher, Phase 2 can add `fs.watch` |
| Navigation to file view | Hash route `/#/document/:name` | Works with existing hash router, supports back button |
| Board dashboard | Fully replaced | Clean break — boards are not part of the new product direction |

## File Manifest

### New Files

| File | Purpose |
|------|---------|
| `electron/ipc/docs.ts` | IPC handlers for folder selection, file listing, file reading |
| `src/routes/document-list.tsx` | Main view — folder selection + file list |
| `src/routes/document-view.tsx` | Single file viewer |
| `src/state/document-store.ts` | Zustand store for folder path + file list |

### Modified Files

| File | Changes |
|------|---------|
| `electron/lib/channels.ts` | Add 4 new channel constants |
| `electron/lib/desktop-api.ts` | Add `docs` namespace to interface |
| `electron/lib/validators.ts` | Add Zod schemas for doc payloads |
| `electron/preload.ts` | Expose `docs` API via contextBridge |
| `electron/ipc/index.ts` | Register doc handlers |
| `src/lib/ipc/client.ts` | Add `docs` client wrapper |
| `src/router.tsx` | Replace dashboard route, add document view route |
| `src/App.tsx` | Update header if needed (e.g., show folder name) |

### Deleted Files

| File | Reason |
|------|--------|
| `src/routes/dashboard.tsx` | Replaced by document-list |
| `src/state/board-store.ts` | Board functionality removed |
| `src/lib/persistence/schema.ts` | Board schema no longer needed |

## Dependencies

- May need `electron-store` for main-process persistence (check if already available or use a simple JSON file approach with `app.getPath('userData')`)
- No new renderer dependencies for Phase 1 (raw text display)

## References

- Existing IPC pattern: `electron/ipc/files.ts`, `electron/lib/channels.ts`, `electron/lib/desktop-api.ts`
- Existing Zustand store: `src/state/board-store.ts`
- App conventions: `apps/greyboard-desktop/AGENTS.md`
- Original brainstorm: `docs/brainstorms/2026-02-04-greyboard-desktop-app-brainstorm.md`
- Completed architecture plan: `docs/plans/completed/2026-02-15-feat-greyboard-desktop-app-plan.md`
