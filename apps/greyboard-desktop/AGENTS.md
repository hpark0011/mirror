# Greyboard Desktop

Electron + Vite + React desktop application for reading markdown documents from a user-selected folder.

## Commands

```bash
pnpm dev           # Start dev server with Electron
pnpm build         # Build Vite + Electron
pnpm dist          # Build and package with electron-builder
pnpm lint          # ESLint
pnpm check-types   # TypeScript check
pnpm clean         # Remove build artifacts and node_modules
```

## Tech Stack

| Category   | Technology                                    |
| ---------- | --------------------------------------------- |
| Desktop    | Electron 35, Vite 6.3, electron-updater      |
| Frontend   | React 19, TypeScript                          |
| Routing    | react-router-dom 7                            |
| Styling    | Tailwind CSS 4, shadcn/ui (via @feel-good/ui) |
| State      | Zustand 5                                     |
| Validation | Zod                                           |
| Icons      | @feel-good/icons                              |

## Project Structure

```
electron/
  main.ts                # Electron main process
  preload.ts             # Preload script (contextBridge)
  lib/
    channels.ts          # IPC channel constants
    desktop-api.ts       # DesktopAPI interface type
    validators.ts        # Zod validation schemas
  ipc/
    app.ts               # App info handlers (version, platform)
    docs.ts              # Document folder & file handlers
    notifications.ts     # System notifications
    updates.ts           # Auto-update handlers

src/
  main.tsx               # React entry point
  App.tsx                # Root component
  router.tsx             # react-router-dom setup
  routes/
    document-list.tsx    # Folder selection + file listing page
    document-view.tsx    # Single markdown file viewer
  state/
    document-store.ts    # Document state (folder path, file list)
  lib/
    ipc/
      client.ts          # IPC client wrapper
  types/                 # App-wide types
```

## Architecture

### Electron Setup

- **contextIsolation: true** - Renderer has no direct Node access
- **sandbox: true** - Renderer runs in restricted sandbox
- **preload.ts** - Exposes `window.greyboardDesktop` API via `contextBridge`
- **CSP** - Strict Content Security Policy (allows dev server URL in dev mode)

### IPC Pattern

**Channel definition** (single source of truth):
```typescript
// electron/lib/channels.ts
export const CHANNELS = {
  APP_GET_VERSION: 'greyboard:app:getVersion',
  DOCS_SELECT_FOLDER: 'greyboard:docs:selectFolder',
  DOCS_GET_FOLDER: 'greyboard:docs:getFolder',
  DOCS_LIST_FILES: 'greyboard:docs:listFiles',
  DOCS_READ_FILE: 'greyboard:docs:readFile',
  // ...
}
```

**Channel responsibilities:**
- `DOCS_SELECT_FOLDER` — Opens native folder picker, persists selection to main process
- `DOCS_GET_FOLDER` — Returns current folder path (verifies it still exists on disk)
- `DOCS_LIST_FILES` — Lists `.md` files in the folder with metadata (name, size, lastModified)
- `DOCS_READ_FILE` — Reads a single `.md` file with security validation (path traversal, symlink, size check)

**Type-safe API**:
```typescript
// electron/lib/desktop-api.ts
export interface DesktopAPI { /* ... */ }

// electron/preload.ts
contextBridge.exposeInMainWorld('greyboardDesktop', { /* ... */ } satisfies DesktopAPI)

// src/lib/ipc/client.ts
export const desktopAPI = { /* wrapper with fallbacks */ }
```

**Renderer usage**:
```typescript
const folder = await desktopAPI.docs.getFolder()
const files = await desktopAPI.docs.listFiles()
const doc = await desktopAPI.docs.readFile('my-doc.md')
```

### State Management

Zustand without persist middleware:

```typescript
// src/state/document-store.ts
export const useDocumentStore = create<DocumentState & DocumentActions>()(
  (set, get) => ({
    folderPath: null,
    files: [],
    isLoading: false,
    error: null,
    loadFolder: async () => { /* ... */ },
    selectFolder: async () => { /* ... */ },
  })
)
```

**Actions:**
- `loadFolder()` — Loads persisted folder from main process, verifies existence, lists files
- `selectFolder()` — Opens native folder picker, lists files after selection

**Note:** Folder persistence is handled by the main process (`userData/docs-settings.json`), not renderer localStorage. The renderer store is ephemeral — it rehydrates from the main process on startup.

### Security

File access in the main process is hardened at multiple layers:

- File names validated with Zod (no path separators, no `..`, no null bytes, must end in `.md`)
- `realpath()` used to resolve symlinks before checking the path is within the selected folder
- `lstat()` rejects symlinks explicitly — only regular files are served
- 10MB file size limit enforced before reading
- Errors sanitized before sending to renderer — stack traces and system paths are never exposed

## Path Aliases

`@/*` maps to root:
```typescript
import { desktopAPI } from '@/lib/ipc/client'
```

## Import Conventions

```typescript
// ✅ Type imports
import { useState, type KeyboardEvent } from "react"

// ❌ Don't
import React from "react"
```

---

**Response format:** Always provide a copy-paste commit message at the end.
