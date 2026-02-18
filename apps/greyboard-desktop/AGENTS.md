# Greyboard Desktop

Electron + Vite + React desktop application for Greyboard task management.

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

| Category  | Technology                                    |
| --------- | --------------------------------------------- |
| Desktop   | Electron 35, Vite 6.3, electron-updater      |
| Frontend  | React 19, TypeScript                          |
| Routing   | react-router-dom 7                            |
| Styling   | Tailwind CSS 4, shadcn/ui (via @feel-good/ui) |
| State     | Zustand 5 (persist middleware)                |
| Validation | Zod                                           |
| Icons     | @feel-good/icons, Lucide React                |

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
    files.ts             # File import/export handlers
    notifications.ts     # System notifications
    updates.ts           # Auto-update handlers

src/
  main.tsx               # React entry point
  App.tsx                # Root component
  router.tsx             # react-router-dom setup
  routes/                # Page components
  components/            # App components
  state/                 # Zustand stores
    board-store.ts       # Board CRUD + import/export
  lib/
    ipc/
      client.ts          # IPC client wrapper
    persistence/
      schema.ts          # Board schema + types (Zod)
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
  FILES_IMPORT_BOARD: 'greyboard:files:importBoard',
  // ...
}
```

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
const json = await desktopAPI.files.importBoard()
```

### State Management

Zustand with **persist middleware**:

```typescript
// src/state/board-store.ts
const boardStorage: StateStorage = {
  getItem: (key) => {
    // Parse localStorage, validate with Zod, return zustand envelope
  },
  setItem: (key, value) => {
    // Debounced write to localStorage with version wrapper
  },
}

export const useBoardStore = create<BoardState & BoardActions>()(
  persist((set, get) => ({ /* ... */ }), {
    name: STORAGE_KEY,
    storage: boardStorage,
    partialize: (state) => ({ boards: state.boards }),
  })
)
```

**Why custom storage:**
- localStorage format: `{ version: 1, boards: [...] }`
- Zustand persist format: `{ state: { boards: [...] }, version: 0 }`
- Custom adapter bridges both, validates on read with Zod, debounces writes

**Actions:**
- `addBoard(board)` — Add new board
- `removeBoard(id)` — Delete board
- `updateBoard(id, updates)` — Patch board (auto-updates `updatedAt`)
- `importBoard(json)` — Parse JSON, validate, assign new UUID, persist
- `exportBoard(id)` — Serialize board to JSON string

### Board Schema

```typescript
// src/lib/persistence/schema.ts
export const persistedBoardV1Schema = z.object({
  version: z.literal(1),
  id: z.string(),
  title: z.string(),
  createdAt: z.string(),    // ISO 8601
  updatedAt: z.string(),
  data: z.record(z.string(), z.unknown()),  // Flexible payload
})
```

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
