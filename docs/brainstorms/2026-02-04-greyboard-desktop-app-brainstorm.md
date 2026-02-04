# Greyboard Desktop App Brainstorm

**Date:** 2026-02-04
**Status:** Ready for planning

## What We're Building

A desktop version of Greyboard (the AI-powered task management app) for macOS and Windows. The desktop app uses Electron with Vite + React for the renderer, enabling native OS integration while maximizing code sharing with the existing web app.

## Why This Approach

### Goals
- **Native OS integration:** System notifications, file system access
- **Distribution:** Standalone installable app (not just a browser bookmark)
- **Performance:** Dedicated resources, faster startup than browser

### Technology Decisions

#### Electron Over Alternatives

| Approach | Considered | Decision |
|----------|-----------|----------|
| **Electron** | Mature ecosystem, consistent rendering | **Selected** |
| Tauri | Smaller bundle, Rust backend | Rejected—Rust learning curve, newer ecosystem |
| Neutralino | Ultra-lightweight | Rejected—limited native APIs for our needs |

Electron was chosen because:
1. Battle-tested ecosystem with extensive documentation
2. Node.js backend familiar to the team
3. Consistent Chromium rendering across platforms

#### Vite Over Next.js (for Desktop)

| Aspect | Next.js | Vite + React |
|--------|---------|--------------|
| **Bundle size** | Larger (includes server runtime) | Smaller (client-only) |
| **Build speed** | Slower | Much faster (Vite's HMR) |
| **Complexity** | Higher (SSR quirks in Electron) | Simpler (static SPA) |
| **Routing** | File-based (overkill for Electron) | React Router (explicit) |

Vite was chosen because:
1. No SSR needed in Electron—app loads locally
2. Faster development with Vite's HMR
3. Simpler build pipeline (no custom server needed)
4. Cleaner separation of client-only code

## Key Decisions

### 1. Monorepo Structure

```
apps/
  greyboard/                  # Existing Next.js web app (unchanged)
  greyboard-desktop/          # NEW: Electron + Vite + React
    electron/                 # Main process (Node.js)
      main.ts                 # App entry point
      preload.ts              # Preload scripts for IPC
      ipc/                    # IPC handlers
    src/                      # Renderer (Vite React app)
      App.tsx                 # Root component
      routes/                 # React Router pages
      platform/               # Desktop-specific adapters
    vite.config.ts            # Vite config for Electron
    electron-builder.yml      # Build/distribution config
    package.json

packages/
  greyboard-core/             # NEW: Extracted shared code
    components/               # Pure React components (no Next.js deps)
    features/                 # Feature modules (kanban, timer, etc.)
    hooks/                    # Shared hooks
    store/                    # Zustand stores
    types/                    # TypeScript types
    lib/                      # Utilities, schemas
```

### 2. Code Sharing Strategy

**Maximum sharing with clean boundaries:**

Extract `packages/greyboard-core` containing:
- All feature modules from `apps/greyboard/features/`
- Shared hooks from `apps/greyboard/hooks/`
- Zustand stores from `apps/greyboard/store/`
- Types from `apps/greyboard/types/`

**Critical rule:** `greyboard-core` must have **zero Next.js dependencies**:
- No `next/navigation` → Use framework-agnostic navigation props
- No `next/image` → Use standard `<img>` or wrapper component
- No server actions → Use hooks that accept API/IPC adapters

**Web app (`apps/greyboard`):**
- Imports from `@feel-good/greyboard-core`
- Wraps with Next.js-specific components (Image, Link)
- Keeps server actions for web features

**Desktop app (`apps/greyboard-desktop`):**
- Imports from `@feel-good/greyboard-core`
- Uses React Router for navigation
- Uses IPC adapters for native features

### 3. Renderer Stack (Vite + React)

```
apps/greyboard-desktop/
  src/
    App.tsx                   # Root with providers
    routes/
      index.tsx               # Dashboard (kanban board)
      settings.tsx            # App settings
    platform/
      notifications.ts        # IPC wrapper for native notifications
      file-system.ts          # IPC wrapper for file dialogs
      storage.ts              # Electron store (or localStorage)
    providers/
      RouterProvider.tsx      # React Router setup
      ThemeProvider.tsx       # Theme (from @feel-good/ui)
```

**Dependencies:**
- `vite` + `@vitejs/plugin-react`
- `react-router-dom` (client-side routing)
- `@tanstack/react-query` (data fetching, same as web)
- `zustand` (state management, same as web)

### 4. IPC Architecture

Electron's main ↔ renderer communication:
```
Renderer (React)  ←→  Preload (contextBridge)  ←→  Main (Node.js)
```

Expose typed APIs via `contextBridge`:
```typescript
// electron/preload.ts
contextBridge.exposeInMainWorld('electron', {
  notifications: {
    show: (title: string, body: string) =>
      ipcRenderer.invoke('notification:show', title, body)
  },
  fs: {
    openFile: () => ipcRenderer.invoke('dialog:openFile'),
    saveFile: (data: string) => ipcRenderer.invoke('dialog:saveFile', data)
  },
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    checkForUpdates: () => ipcRenderer.invoke('app:checkForUpdates')
  }
});
```

Type definitions for renderer:
```typescript
// src/types/electron.d.ts
interface ElectronAPI {
  notifications: { show: (title: string, body: string) => Promise<void> };
  fs: { openFile: () => Promise<string>; saveFile: (data: string) => Promise<void> };
  app: { getVersion: () => Promise<string>; checkForUpdates: () => Promise<void> };
}
declare global {
  interface Window { electron: ElectronAPI }
}
```

### 5. Build & Distribution

| Platform | Installer | Auto-update |
|----------|-----------|-------------|
| macOS | `.dmg` | electron-updater (GitHub Releases) |
| Windows | `.exe` (NSIS) | electron-updater (GitHub Releases) |

Build pipeline:
1. `vite build` → Produces static assets in `dist/`
2. `electron-builder` → Packages with Electron runtime

### 6. Native Features (Phase 1)

| Feature | Implementation |
|---------|----------------|
| Native notifications | Electron `Notification` API via IPC |
| File import/export | `dialog.showOpenDialog`, `dialog.showSaveDialog` |
| Auto-launch on startup | `app.setLoginItemSettings()` |
| Deep links | Custom protocol `greyboard://` |

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    apps/greyboard-desktop                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌───────────────────┐      ┌────────────────────────────────┐  │
│  │  Electron Main    │      │  Electron Renderer             │  │
│  │  (Node.js)        │ IPC  │  (Vite + React)                │  │
│  │                   │◄────►│                                │  │
│  │  - File dialogs   │      │  ┌──────────────────────────┐  │  │
│  │  - Notifications  │      │  │ React Router             │  │  │
│  │  - Auto-updater   │      │  │   └─ routes/             │  │  │
│  │  - Window mgmt    │      │  │                          │  │  │
│  │  - Protocol       │      │  │ Platform Adapters        │  │  │
│  └───────────────────┘      │  │   └─ platform/           │  │  │
│                             │  │                          │  │  │
│                             │  │ Shared Code              │  │  │
│                             │  │   └─ @feel-good/         │  │  │
│                             │  │      greyboard-core      │  │  │
│                             │  └──────────────────────────┘  │  │
│                             └────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                       │
                                       │ imports
                                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                   packages/greyboard-core                       │
│            (Pure React, no Next.js dependencies)                │
├─────────────────────────────────────────────────────────────────┤
│  features/   │   hooks/   │   store/   │   types/   │   lib/   │
│  - kanban    │   - use*   │   - board  │   - Task   │   - cn   │
│  - timer     │            │   - timer  │   - Board  │   - zod  │
│  - tickets   │            │            │            │          │
└─────────────────────────────────────────────────────────────────┘
         │                                        │
         │ imports                                │ imports
         ▼                                        ▼
┌─────────────────────────┐            ┌─────────────────────────┐
│   apps/greyboard (web)  │            │ apps/greyboard-desktop  │
│   Next.js wrappers      │            │ React Router + IPC      │
│   Server actions        │            │ Native adapters         │
└─────────────────────────┘            └─────────────────────────┘
```

## Open Questions

1. **Data storage in desktop:**
   - Keep localStorage (simpler, same as web)?
   - Use `electron-store` for better persistence?
   - SQLite via `better-sqlite3` for complex queries?

2. **Supabase auth in desktop:**
   - OAuth flows need custom protocol handler for redirects
   - Use `protocol.handle()` for `greyboard://auth/callback`
   - Or switch to magic link / passwordless for desktop?

3. **Auto-update infrastructure:**
   - GitHub Releases (free, integrated with repo)?
   - Needs Apple Developer account for macOS notarization
   - Needs code signing cert for Windows

4. **Release cadence:**
   - Separate versioning for web vs desktop?
   - Unified semver with platform-specific builds?

## Out of Scope (Phase 2+)

- System tray with quick actions
- Global keyboard shortcuts
- Linux support
- Offline-first with sync (requires backend changes)
- SQLite local database

## Next Steps

Run `/workflows:plan` to create implementation tasks:

1. **Extract `packages/greyboard-core`**
   - Identify Next.js-specific code to exclude
   - Move features, hooks, stores, types
   - Create framework-agnostic navigation/image wrappers

2. **Scaffold `apps/greyboard-desktop`**
   - Vite + React setup
   - Electron main process
   - IPC bridge with typed APIs

3. **Implement platform adapters**
   - Native notifications
   - File system dialogs

4. **Build pipeline**
   - Vite build → electron-builder
   - macOS and Windows targets
   - Auto-update configuration

5. **CI/CD**
   - GitHub Actions for builds
   - Code signing setup
