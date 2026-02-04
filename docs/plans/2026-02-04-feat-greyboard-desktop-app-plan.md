---
title: "feat: Greyboard Desktop App"
type: feat
date: 2026-02-04
brainstorm: docs/brainstorms/2026-02-04-greyboard-desktop-app-brainstorm.md
---

# feat: Greyboard Desktop App

Build a desktop version of Greyboard for macOS and Windows using Electron + Vite + React, with shared code extracted to `@feel-good/greyboard-core`.

## Overview

Create a native desktop application that shares core functionality with the web app while enabling OS-level features like native notifications and file system access. The implementation is split into two main workstreams:

1. **Extract shared code** to `packages/greyboard-core`
2. **Build desktop app** at `apps/greyboard-desktop`

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    apps/greyboard-desktop                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌───────────────────┐      ┌────────────────────────────────┐  │
│  │  Electron Main    │ IPC  │  Electron Renderer             │  │
│  │  (Node.js)        │◄────►│  (Vite + React)                │  │
│  └───────────────────┘      └────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                       │ imports
                                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                   packages/greyboard-core                       │
│            (Pure React, no Next.js dependencies)                │
└─────────────────────────────────────────────────────────────────┘
         │                                        │
         ▼                                        ▼
┌─────────────────────────┐            ┌─────────────────────────┐
│   apps/greyboard (web)  │            │ apps/greyboard-desktop  │
└─────────────────────────┘            └─────────────────────────┘
```

## Implementation Phases

### Phase 1: Extract `@feel-good/greyboard-core`

Extract framework-agnostic code to a shared package.

#### 1.1 Create Package Scaffold

Create the package structure following monorepo patterns.

**Files to create:**

```
packages/greyboard-core/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    ├── types/
    │   └── index.ts
    ├── stores/
    │   └── index.ts
    ├── hooks/
    │   └── index.ts
    ├── features/
    │   └── index.ts
    ├── utils/
    │   └── index.ts
    └── config/
        └── index.ts
```

**packages/greyboard-core/package.json:**
```json
{
  "name": "@feel-good/greyboard-core",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "sideEffects": false,
  "exports": {
    ".": "./src/index.ts",
    "./types": "./src/types/index.ts",
    "./stores": "./src/stores/index.ts",
    "./hooks": "./src/hooks/index.ts",
    "./features/*": "./src/features/*.tsx",
    "./utils": "./src/utils/index.ts",
    "./config": "./src/config/index.ts"
  },
  "peerDependencies": {
    "react": "catalog:",
    "react-dom": "catalog:"
  },
  "dependencies": {
    "zustand": "catalog:",
    "zod": "catalog:",
    "@feel-good/ui": "workspace:*",
    "@feel-good/icons": "workspace:*"
  },
  "devDependencies": {
    "@feel-good/tsconfig": "workspace:*",
    "@feel-good/eslint-config": "workspace:*",
    "typescript": "catalog:"
  }
}
```

**packages/greyboard-core/tsconfig.json:**
```json
{
  "extends": "@feel-good/tsconfig/react-library.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] Create `packages/greyboard-core/package.json`
- [ ] Create `packages/greyboard-core/tsconfig.json`
- [ ] Create directory structure with barrel exports
- [ ] Run `pnpm install` from root to link workspace

#### 1.2 Move Types

Move type definitions first (no dependencies).

**Files to move:**
- `apps/greyboard/types/board.types.ts` → `packages/greyboard-core/src/types/board.ts`
- `apps/greyboard/types/project.types.ts` → `packages/greyboard-core/src/types/project.ts` (if exists)

**src/types/index.ts:**
```typescript
export * from "./board";
export * from "./project";
```

- [ ] Move `board.types.ts` to core package
- [ ] Create barrel export in `types/index.ts`
- [ ] Update imports in greyboard app

#### 1.3 Move Configuration

Move constants and configuration.

**Files to move:**
- `apps/greyboard/config/board.config.ts` → `packages/greyboard-core/src/config/board.ts`
- `apps/greyboard/lib/storage-keys.ts` → `packages/greyboard-core/src/config/storage-keys.ts`

- [ ] Move `board.config.ts` to core package
- [ ] Move `storage-keys.ts` to core package
- [ ] Create `config/index.ts` barrel export
- [ ] Update imports in greyboard app

#### 1.4 Move Zustand Stores

Move state management (Zustand is framework-agnostic).

**Files to move:**
- `apps/greyboard/features/timer/store/stop-watch-store.ts` → `packages/greyboard-core/src/stores/stop-watch-store.ts`
- `apps/greyboard/store/board-actions-store.ts` → `packages/greyboard-core/src/stores/board-actions-store.ts`

- [ ] Move `stop-watch-store.ts` to core package
- [ ] Move `board-actions-store.ts` to core package
- [ ] Update internal imports to use new paths
- [ ] Create `stores/index.ts` barrel export
- [ ] Update imports in greyboard app

#### 1.5 Move Framework-Agnostic Hooks

Move hooks that have no Next.js dependencies.

**Hooks to move (confirmed framework-agnostic):**
- `use-local-storage.ts`
- `use-debounced-callback.ts`
- `use-keyboard-submit.ts`
- `use-focus-management.ts`
- `use-mobile.ts`
- `use-dialog-auto-save.ts`
- `use-keyboard-navigation.ts`
- `use-persisted-sub-tasks.ts`

**Hooks to keep in greyboard app (Next.js specific):**
- `use-navigation.ts` (uses `next/navigation`)
- `use-theme-toggle.tsx` (uses `next-themes`)

- [ ] Move 8 framework-agnostic hooks to core package
- [ ] Create `hooks/index.ts` barrel export
- [ ] Keep `use-navigation.ts` and `use-theme-toggle.tsx` in app
- [ ] Update imports in greyboard app

#### 1.6 Move Utility Functions

Move pure utility functions.

**Files to move from `apps/greyboard/features/`:**
- `timer/utils/` → `packages/greyboard-core/src/utils/timer/`
- `task-board-core/utils/` → `packages/greyboard-core/src/utils/board/`

- [ ] Move timer utilities to core package
- [ ] Move board utilities to core package
- [ ] Create `utils/index.ts` with organized exports
- [ ] Update imports in greyboard app

#### 1.7 Move Feature Components

Move feature modules (already framework-agnostic based on research).

**Features to move:**
| Feature | Dependencies |
|---------|--------------|
| `timer` | Self-contained |
| `project-select` | Self-contained |
| `sub-task` | Self-contained |
| `sub-task-list` | sub-task |
| `task-board-core` | timer (moved) |
| `ticket-card` | timer, project-select |
| `ticket-form` | project-select |
| `kanban-board` | task-board-core, ticket-card, timer |
| `task-list` | task-board-core, ticket-card |
| `insights` | timer, project-select |

**Order of extraction (respecting dependencies):**
1. `timer`, `project-select`, `sub-task` (no deps)
2. `sub-task-list`, `task-board-core` (one dep each)
3. `ticket-card`, `ticket-form` (two deps)
4. `kanban-board`, `task-list`, `insights` (multiple deps)

**Important:** Features import UI from `@/components/ui/`. Update to use `@feel-good/ui/primitives/*`.

- [ ] Move `timer` feature to core package
- [ ] Move `project-select` feature to core package
- [ ] Move `sub-task` feature to core package
- [ ] Move `sub-task-list` feature to core package
- [ ] Move `task-board-core` feature to core package
- [ ] Move `ticket-card` feature to core package
- [ ] Move `ticket-form` feature to core package
- [ ] Move `kanban-board` feature to core package
- [ ] Move `task-list` feature to core package
- [ ] Move `insights` feature to core package
- [ ] Update all UI imports to `@feel-good/ui/primitives/*`
- [ ] Update all internal imports to relative paths
- [ ] Create `features/index.ts` barrel export

#### 1.8 Update Greyboard Web App

Update the web app to import from the core package.

**apps/greyboard/package.json addition:**
```json
{
  "dependencies": {
    "@feel-good/greyboard-core": "workspace:*"
  }
}
```

**Tailwind configuration (`apps/greyboard/app/globals.css`):**
```css
@source "../node_modules/@feel-good/greyboard-core";
```

- [ ] Add `@feel-good/greyboard-core` dependency
- [ ] Add `@source` directive to Tailwind config
- [ ] Update all imports to use `@feel-good/greyboard-core/*`
- [ ] Verify web app still builds and runs
- [ ] Run existing tests to verify no regressions

---

### Phase 2: Scaffold Desktop App

Create the Electron + Vite + React desktop application.

#### 2.1 Initialize App Directory

**Directory structure:**
```
apps/greyboard-desktop/
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── electron-builder.yml
├── electron/
│   ├── main.ts
│   ├── preload.ts
│   └── ipc/
│       ├── index.ts
│       ├── notifications.ts
│       └── file-system.ts
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── index.html
│   ├── routes/
│   │   ├── index.tsx
│   │   └── settings.tsx
│   ├── platform/
│   │   ├── notifications.ts
│   │   ├── file-system.ts
│   │   └── storage.ts
│   ├── providers/
│   │   └── root-provider.tsx
│   └── types/
│       └── electron.d.ts
└── resources/
    └── icon.png
```

**apps/greyboard-desktop/package.json:**
```json
{
  "name": "@feel-good/greyboard-desktop",
  "version": "0.1.0",
  "private": true,
  "main": "dist-electron/main.js",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build && electron-builder",
    "build:mac": "pnpm build --mac",
    "build:win": "pnpm build --win",
    "preview": "vite preview",
    "electron:dev": "concurrently \"vite\" \"wait-on http://localhost:5173 && electron .\"",
    "lint": "eslint ."
  },
  "dependencies": {
    "@feel-good/greyboard-core": "workspace:*",
    "@feel-good/ui": "workspace:*",
    "@feel-good/icons": "workspace:*",
    "@tanstack/react-query": "catalog:",
    "react": "catalog:",
    "react-dom": "catalog:",
    "react-router-dom": "^7.1.0",
    "zustand": "catalog:"
  },
  "devDependencies": {
    "@feel-good/tsconfig": "workspace:*",
    "@feel-good/eslint-config": "workspace:*",
    "@types/react": "catalog:",
    "@types/react-dom": "catalog:",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "catalog:",
    "concurrently": "^9.0.0",
    "electron": "^33.0.0",
    "electron-builder": "^25.0.0",
    "postcss": "catalog:",
    "tailwindcss": "catalog:",
    "typescript": "catalog:",
    "vite": "catalog:",
    "vite-plugin-electron": "^0.28.0",
    "vite-plugin-electron-renderer": "^0.14.5",
    "wait-on": "^8.0.0"
  }
}
```

- [ ] Create `apps/greyboard-desktop/` directory
- [ ] Create `package.json` with dependencies
- [ ] Create `tsconfig.json` extending react-library
- [ ] Create `tsconfig.node.json` for Electron main process
- [ ] Run `pnpm install` from root

#### 2.2 Configure Vite for Electron

**apps/greyboard-desktop/vite.config.ts:**
```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import electron from "vite-plugin-electron";
import renderer from "vite-plugin-electron-renderer";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: "electron/main.ts",
        onstart({ startup }) {
          startup();
        },
        vite: {
          build: {
            outDir: "dist-electron",
            rollupOptions: {
              external: ["electron"],
            },
          },
        },
      },
      {
        entry: "electron/preload.ts",
        onstart({ reload }) {
          reload();
        },
        vite: {
          build: {
            outDir: "dist-electron",
          },
        },
      },
    ]),
    renderer(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
  },
});
```

- [ ] Create `vite.config.ts`
- [ ] Create Tailwind config (`tailwind.config.ts`)
- [ ] Create PostCSS config (`postcss.config.js`)
- [ ] Create `src/globals.css` with Tailwind imports and `@source` directive

#### 2.3 Create Electron Main Process

**electron/main.ts:**
```typescript
import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import { registerNotificationHandlers } from "./ipc/notifications";
import { registerFileSystemHandlers } from "./ipc/file-system";

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: "hiddenInset", // macOS native title bar
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  registerNotificationHandlers(ipcMain);
  registerFileSystemHandlers(ipcMain);
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
```

- [ ] Create `electron/main.ts`
- [ ] Create `electron/preload.ts` with contextBridge
- [ ] Create `electron/ipc/index.ts`
- [ ] Create `electron/ipc/notifications.ts`
- [ ] Create `electron/ipc/file-system.ts`

#### 2.4 Create Preload Script

**electron/preload.ts:**
```typescript
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electron", {
  notifications: {
    show: (title: string, body: string) =>
      ipcRenderer.invoke("notification:show", title, body),
  },
  fs: {
    openFile: () => ipcRenderer.invoke("dialog:openFile"),
    saveFile: (data: string, defaultName: string) =>
      ipcRenderer.invoke("dialog:saveFile", data, defaultName),
  },
  app: {
    getVersion: () => ipcRenderer.invoke("app:getVersion"),
    getPlatform: () => process.platform,
  },
});
```

**src/types/electron.d.ts:**
```typescript
interface ElectronAPI {
  notifications: {
    show: (title: string, body: string) => Promise<void>;
  };
  fs: {
    openFile: () => Promise<string | null>;
    saveFile: (data: string, defaultName: string) => Promise<boolean>;
  };
  app: {
    getVersion: () => Promise<string>;
    getPlatform: () => string;
  };
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}

export {};
```

- [ ] Create `electron/preload.ts`
- [ ] Create `src/types/electron.d.ts`

#### 2.5 Create React App Shell

**src/main.tsx:**
```typescript
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./routes";
import { RootProvider } from "./providers/root-provider";
import "./globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RootProvider>
      <RouterProvider router={router} />
    </RootProvider>
  </React.StrictMode>
);
```

**src/routes/index.tsx:**
```typescript
import { createBrowserRouter, createHashRouter } from "react-router-dom";
import { App } from "../App";
import { Dashboard } from "./dashboard";
import { Settings } from "./settings";

// Use hash router for Electron (file:// protocol)
export const router = createHashRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "settings", element: <Settings /> },
    ],
  },
]);
```

**src/routes/dashboard.tsx:**
```typescript
import { KanbanBoard } from "@feel-good/greyboard-core/features/kanban-board";

export function Dashboard() {
  return (
    <div className="h-screen overflow-hidden">
      <KanbanBoard />
    </div>
  );
}
```

- [ ] Create `src/main.tsx`
- [ ] Create `src/index.html`
- [ ] Create `src/App.tsx` with layout
- [ ] Create `src/routes/index.tsx` with hash router
- [ ] Create `src/routes/dashboard.tsx`
- [ ] Create `src/routes/settings.tsx`

#### 2.6 Create Platform Adapters

**src/platform/notifications.ts:**
```typescript
export const notifications = {
  show: async (title: string, body: string) => {
    if (window.electron) {
      await window.electron.notifications.show(title, body);
    } else {
      // Fallback for development in browser
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, { body });
      }
    }
  },
};
```

**src/platform/file-system.ts:**
```typescript
export const fileSystem = {
  openFile: async (): Promise<string | null> => {
    if (window.electron) {
      return window.electron.fs.openFile();
    }
    // Fallback: use file input
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json";
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          const text = await file.text();
          resolve(text);
        } else {
          resolve(null);
        }
      };
      input.click();
    });
  },

  saveFile: async (data: string, defaultName: string): Promise<boolean> => {
    if (window.electron) {
      return window.electron.fs.saveFile(data, defaultName);
    }
    // Fallback: download file
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = defaultName;
    a.click();
    URL.revokeObjectURL(url);
    return true;
  },
};
```

- [ ] Create `src/platform/notifications.ts`
- [ ] Create `src/platform/file-system.ts`
- [ ] Create `src/platform/storage.ts`

#### 2.7 Create Providers

**src/providers/root-provider.tsx:**
```typescript
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@feel-good/ui/providers/theme-provider";
import { Toaster } from "@feel-good/ui/primitives/sonner";

const queryClient = new QueryClient();

interface RootProviderProps {
  children: React.ReactNode;
}

export function RootProvider({ children }: RootProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="greyboard-desktop-theme">
        {children}
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
```

- [ ] Create `src/providers/root-provider.tsx`

---

### Phase 3: Implement IPC Handlers

Create the main process handlers for native features.

#### 3.1 Notification Handler

**electron/ipc/notifications.ts:**
```typescript
import { Notification, type IpcMain } from "electron";

export function registerNotificationHandlers(ipcMain: IpcMain) {
  ipcMain.handle(
    "notification:show",
    async (_event, title: string, body: string) => {
      if (Notification.isSupported()) {
        const notification = new Notification({
          title,
          body,
          silent: false,
        });
        notification.show();
      }
    }
  );
}
```

- [ ] Create `electron/ipc/notifications.ts`

#### 3.2 File System Handler

**electron/ipc/file-system.ts:**
```typescript
import { dialog, type IpcMain, type BrowserWindow } from "electron";
import fs from "fs/promises";

export function registerFileSystemHandlers(ipcMain: IpcMain) {
  ipcMain.handle("dialog:openFile", async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return null;

    const result = await dialog.showOpenDialog(window, {
      properties: ["openFile"],
      filters: [{ name: "JSON Files", extensions: ["json"] }],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const content = await fs.readFile(result.filePaths[0], "utf-8");
    return content;
  });

  ipcMain.handle(
    "dialog:saveFile",
    async (event, data: string, defaultName: string) => {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (!window) return false;

      const result = await dialog.showSaveDialog(window, {
        defaultPath: defaultName,
        filters: [{ name: "JSON Files", extensions: ["json"] }],
      });

      if (result.canceled || !result.filePath) {
        return false;
      }

      await fs.writeFile(result.filePath, data, "utf-8");
      return true;
    }
  );
}
```

- [ ] Create `electron/ipc/file-system.ts`

#### 3.3 App Info Handler

**electron/ipc/app.ts:**
```typescript
import { app, type IpcMain } from "electron";

export function registerAppHandlers(ipcMain: IpcMain) {
  ipcMain.handle("app:getVersion", () => {
    return app.getVersion();
  });
}
```

- [ ] Create `electron/ipc/app.ts`
- [ ] Register handler in `electron/main.ts`

---

### Phase 4: Build & Distribution

Configure electron-builder for macOS and Windows.

#### 4.1 Electron Builder Config

**apps/greyboard-desktop/electron-builder.yml:**
```yaml
appId: com.feelgood.greyboard
productName: Greyboard
directories:
  output: release
  buildResources: resources

files:
  - dist/**/*
  - dist-electron/**/*

mac:
  category: public.app-category.productivity
  target:
    - target: dmg
      arch:
        - x64
        - arm64
  icon: resources/icon.icns
  hardenedRuntime: true
  gatekeeperAssess: false
  entitlements: build/entitlements.mac.plist
  entitlementsInherit: build/entitlements.mac.plist

win:
  target:
    - target: nsis
      arch:
        - x64
  icon: resources/icon.ico

nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
  createStartMenuShortcut: true

publish:
  provider: github
  owner: your-org
  repo: feel-good
```

- [ ] Create `electron-builder.yml`
- [ ] Create `resources/` directory
- [ ] Add app icons (icon.png, icon.icns, icon.ico)
- [ ] Create `build/entitlements.mac.plist` for macOS notarization

#### 4.2 Add Build Scripts to Root

**package.json (root) additions:**
```json
{
  "scripts": {
    "desktop:dev": "pnpm --filter @feel-good/greyboard-desktop electron:dev",
    "desktop:build": "pnpm --filter @feel-good/greyboard-desktop build",
    "desktop:build:mac": "pnpm --filter @feel-good/greyboard-desktop build:mac",
    "desktop:build:win": "pnpm --filter @feel-good/greyboard-desktop build:win"
  }
}
```

- [ ] Add desktop scripts to root package.json
- [ ] Test `pnpm desktop:dev` runs successfully
- [ ] Test `pnpm desktop:build` produces installers

---

## Acceptance Criteria

### Functional Requirements

- [ ] Desktop app launches on macOS and Windows
- [ ] Kanban board displays and functions identically to web
- [ ] Drag and drop works for tickets and columns
- [ ] Timer functionality works (start, stop, persistence)
- [ ] Native notifications display on timer completion
- [ ] File import/export uses native dialogs
- [ ] Theme switching works (light/dark/system)
- [ ] Data persists in localStorage between sessions

### Non-Functional Requirements

- [ ] macOS `.dmg` installer under 200MB
- [ ] Windows `.exe` installer under 200MB
- [ ] Cold start under 3 seconds
- [ ] No console errors in production build
- [ ] TypeScript strict mode passes

### Quality Gates

- [ ] Web app (`apps/greyboard`) still builds and runs
- [ ] No TypeScript errors in workspace
- [ ] ESLint passes across all packages
- [ ] Manual QA on macOS and Windows

---

## Open Questions (to resolve during implementation)

1. **OAuth in Electron:** Supabase OAuth needs protocol handler. Implement `greyboard://auth/callback` or defer to Phase 2?

2. **Auto-updates:** Configure `electron-updater` now or defer? Requires GitHub Releases setup.

3. **Code signing:** Need Apple Developer account and Windows certificate. Proceed without for initial dev builds?

---

## References

### Internal
- Brainstorm: `docs/brainstorms/2026-02-04-greyboard-desktop-app-brainstorm.md`
- UI package pattern: `packages/ui/package.json`
- Features package pattern: `packages/features/package.json`
- Tailwind monorepo config: `docs/solutions/tailwind/monorepo-source-configuration.md`

### External
- [Electron + Vite guide](https://electron-vite.org/)
- [electron-builder docs](https://www.electron.build/)
- [React Router v7](https://reactrouter.com/)
