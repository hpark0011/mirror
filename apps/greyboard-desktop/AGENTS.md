# Greyboard Desktop

Electron + Vite + React desktop application for local-first task management.

## Commands

```bash
pnpm dev           # Start dev server with Electron
pnpm build         # Build Vite + Electron
pnpm dist          # Build and package with electron-builder
pnpm lint          # ESLint
pnpm check-types   # TypeScript check
pnpm clean         # Remove build artifacts and node_modules
```

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
    state.ts             # JSON snapshot state handlers
    notifications.ts     # System notifications
    updates.ts           # Auto-update handlers

src/
  main.tsx               # React entry point
  App.tsx                # Root shell
  router.tsx             # react-router-dom setup
  routes/
    task-workspace.tsx   # Task workspace route
  features/
    tasks/               # Task workspace UI + state interactions
  lib/
    ipc/
      client.ts          # Typed renderer wrapper around desktop API
  types/
```

## IPC Pattern

Channel definition:

```typescript
export const CHANNELS = {
  APP_GET_VERSION: 'greyboard:app:getVersion',
  APP_GET_PLATFORM: 'greyboard:app:getPlatform',
  STATE_LOAD: 'greyboard:state:load',
  STATE_SAVE: 'greyboard:state:save',
  STATE_IMPORT: 'greyboard:state:import',
  STATE_EXPORT: 'greyboard:state:export',
  NOTIFICATIONS_SHOW: 'greyboard:notifications:show',
  UPDATES_CHECK: 'greyboard:updates:check',
  UPDATES_ON_STATUS: 'greyboard:updates:onStatus',
} as const
```

State responsibilities:
- `STATE_LOAD` reads persisted snapshot from `app.getPath('userData')/greyboard-state.json`
- `STATE_SAVE` validates and atomically persists snapshot state
- `STATE_IMPORT` validates and imports snapshot JSON (legacy migration supported)
- `STATE_EXPORT` returns normalized snapshot JSON

Renderer usage:

```typescript
const snapshot = await desktopAPI.state.load()
await desktopAPI.state.save(snapshot)
await desktopAPI.state.importSnapshot(json)
const exported = await desktopAPI.state.exportSnapshot()
```

## Security

- `contextIsolation: true` and `sandbox: true`
- No direct renderer filesystem access
- Snapshot payload validation is done in main process before write
- Atomic writes (temp file + rename) reduce partial-write corruption risk

## Path Aliases

`@/*` maps to app root:

```typescript
import { desktopAPI } from '@/src/lib/ipc/client'
```

---

**Response format:** Always provide a copy-paste commit message at the end.
