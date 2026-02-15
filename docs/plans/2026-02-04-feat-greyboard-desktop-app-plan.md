---
title: "feat: Greyboard Desktop App (Electron + Vite + React 19.2)"
type: feat
date: 2026-02-15
brainstorm: docs/brainstorms/2026-02-04-greyboard-desktop-app-brainstorm.md
---

# feat: Greyboard Desktop App (Electron + Vite + React 19.2)

## Summary

Build `@feel-good/greyboard-desktop` in this monorepo using:
- TypeScript
- Electron (`main` + `preload` + `renderer`)
- React 19.2 + Vite renderer
- Tailwind CSS v4 + Radix primitives + shadcn-style patterns
- esbuild for Electron `main/preload`

This plan is scoped for V1 scaffold + core shell with local-first data and production-grade release pipeline.

## Locked Product Decisions

- V1 scope: scaffold + core shell (not full feature parity).
- Code sharing strategy: incremental extraction (no big-bang migration).
- V1 data/auth: local-first persistence, no auth/backend integration.
- Release target: production pipeline now.
- Distribution/update channel: GitHub Releases.

## Architecture

- New app: `apps/greyboard-desktop`
- Process model:
  - Electron Main: window lifecycle, IPC handlers, updater
  - Electron Preload: typed and restricted `contextBridge` API
  - Renderer: Vite SPA + React Router (hash routing for file protocol)
- UI stack:
  - Tailwind v4 imports + `@source` monorepo scanning
  - `@feel-good/ui` primitives (Radix/shadcn style)
- Build split:
  - Vite: renderer (`dist/`)
  - esbuild: main/preload (`dist-electron/`)
  - electron-builder: installers (`release/`)

## Public Interfaces

### Preload Bridge

Expose `window.greyboardDesktop` with typed APIs only.

- `app.getVersion(): Promise<string>`
- `app.getPlatform(): Promise<"darwin" | "win32" | "linux">`
- `notifications.show(payload: { title: string; body: string }): Promise<void>`
- `files.importBoard(): Promise<PersistedBoardV1 | null>`
- `files.exportBoard(payload: PersistedBoardV1): Promise<{ saved: boolean; path?: string }>`
- `updates.check(): Promise<void>`
- `updates.onStatus(callback): () => void`

### Persistence Contract

```ts
type PersistedBoardV1 = {
  version: 1;
  exportedAt: string;
  board: BoardState;
};
```

## Implementation Phases

### Phase 0: Workspace Wiring

- [ ] Create `apps/greyboard-desktop/package.json`
- [ ] Create `apps/greyboard-desktop/tsconfig.json` (renderer)
- [ ] Create `apps/greyboard-desktop/tsconfig.node.json` (main/preload)
- [ ] Create `apps/greyboard-desktop/eslint.config.mjs` using `@feel-good/eslint-config/base`
- [ ] Add root scripts in `/Users/disquiet/Desktop/feel-good/package.json`:
  - `desktop:dev`
  - `desktop:build`
  - `desktop:dist`
  - `desktop:lint`
  - `desktop:check-types`
- [ ] Update `/Users/disquiet/Desktop/feel-good/turbo.json` outputs for `dist-electron/**`

### Phase 1: Toolchain Setup (Vite + esbuild)

- [ ] Add `apps/greyboard-desktop/vite.config.ts` with:
  - React plugin
  - alias `@ -> ./src`
  - `base: "./"` for packaged app loading
- [ ] Add esbuild scripts:
  - `electron/main.ts -> dist-electron/main.cjs`
  - `electron/preload.ts -> dist-electron/preload.cjs`
- [ ] Add dev orchestration:
  - Vite dev server
  - esbuild watch
  - Electron restart on main/preload rebuild
- [ ] Add build orchestration:
  - `build`: renderer + main + preload
  - `dist`: electron-builder packaging

### Phase 2: Electron Foundation

- [ ] Create `apps/greyboard-desktop/electron/main.ts`
- [ ] Create `apps/greyboard-desktop/electron/preload.ts`
- [ ] Create IPC handlers:
  - `electron/ipc/app.ts`
  - `electron/ipc/files.ts`
  - `electron/ipc/notifications.ts`
  - `electron/ipc/updates.ts`
- [ ] Set secure webPreferences:
  - `contextIsolation: true`
  - `nodeIntegration: false`
  - `sandbox: true`
- [ ] Validate IPC payloads with Zod before file operations

### Phase 3: Renderer Shell

- [ ] Create renderer entry files:
  - `index.html`
  - `src/main.tsx`
  - `src/App.tsx`
  - `src/router.tsx`
  - `src/routes/dashboard.tsx`
  - `src/routes/settings.tsx`
- [ ] Configure styles:
  - `styles/globals.css` with Tailwind v4 imports
  - `@import "@feel-good/ui/styles.css"`
  - `@source "../node_modules/@feel-good/ui"`
- [ ] Add `components.json` for shadcn-style generation in this app (`rsc: false`)
- [ ] Add `src/types/desktop-api.ts` and `src/types/global.d.ts`

### Phase 4: Local-First Data

- [ ] Create `src/state/board-store.ts`
- [ ] Create `src/lib/persistence/local-storage.ts`
- [ ] Create `src/lib/persistence/schema.ts`
- [ ] Create `src/lib/ipc/client.ts`
- [ ] Wire dashboard actions to import/export APIs
- [ ] Confirm state survives restart

### Phase 5: Packaging + Signing + Updates

- [ ] Create `apps/greyboard-desktop/electron-builder.yml`
- [ ] Configure targets:
  - macOS `dmg` (`arm64`, `x64`)
  - Windows `nsis` (`x64`)
- [ ] Add icons/resources under `apps/greyboard-desktop/resources/`
- [ ] Configure GitHub publish for releases
- [ ] Integrate `electron-updater` status flow via IPC

### Phase 6: Release CI

- [ ] Add `.github/workflows/desktop-ci.yml`:
  - lint
  - typecheck
  - build
- [ ] Add `.github/workflows/desktop-release.yml`:
  - tag-triggered release
  - macOS + Windows matrix
  - publish to GitHub Releases
- [ ] Define required secrets:
  - `GH_TOKEN`
  - macOS signing/notarization credentials
  - Windows signing certificate credentials

### Phase 7: Incremental Shared-Code Extraction (Post V1)

- [ ] Introduce `packages/greyboard-core` only when first reusable desktop/web domain module is ready
- [ ] Extraction order:
  - board types/constants
  - pure stores/hooks
  - domain logic
- [ ] Keep `@feel-good/features` out of desktop initially (current Next peer coupling)

## Verification

- [ ] `pnpm --filter @feel-good/greyboard-desktop lint`
- [ ] `pnpm --filter @feel-good/greyboard-desktop check-types`
- [ ] `pnpm --filter @feel-good/greyboard-desktop build`
- [ ] `pnpm desktop:dev` launches app and HMR works
- [ ] Preload API exists and only exposes approved methods
- [ ] Import/export handles cancel + invalid payload safely
- [ ] Local persistence restores data after restart
- [ ] Release workflow publishes installers to GitHub Releases
- [ ] Update status events emit without runtime errors

## Acceptance Criteria

- Desktop app runs in dev and packaged mode on macOS + Windows.
- React 19.2 + Vite + Tailwind v4 + Radix/shadcn patterns are in place.
- Electron main/preload are built with esbuild.
- Typed preload bridge is implemented and locked down.
- Production release pipeline (build + publish + update checks) is configured.
- V1 works local-first without auth/backend dependency.

## Assumptions

- Node engine remains `>=20.9.0`.
- Linux support is out of scope for initial release.
- Single-window desktop UX in V1.
- Local storage persistence is acceptable for V1.
- Existing web apps remain unchanged functionally while desktop is introduced.
