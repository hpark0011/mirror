---
title: "Agent Orchestration: Greyboard Desktop App"
type: orchestration
date: 2026-02-15
source: docs/plans/2026-02-15-feat-greyboard-desktop-app-plan.md
---

# Agent Orchestration: Greyboard Desktop App

## Summary

Orchestrate multi-agent implementation of `@feel-good/greyboard-desktop` — an Electron + Vite + React 19.2 desktop app with local-first data and production release pipeline.

**Scope**: Large (6 execution phases, 14 agents total)
**Target**: `apps/greyboard-desktop` (new) + root config updates
**Execution strategy**: Checkpoint Team (user checkpoint every 2 phases)
**Phase 7 (shared-code extraction)**: excluded — post-V1 scope

---

## Phase Dependency Graph

```
Phase 0: Workspace Wiring
    │
    ▼
Phase 1: Toolchain Setup (Vite + esbuild)
    │
    ├──────────────────┐
    ▼                  ▼
Phase 2: Electron    Phase 3: Renderer Shell
Foundation           (parallel — different dirs)
    │                  │
    └──────┬───────────┘
           ▼
Phase 4: Local-First Data
    │
    ▼
Phase 5: Packaging + Updates
    │
    ▼
Phase 6: Release CI
```

**Parallelism**: Phases 2 and 3 run concurrently (different directories, no file overlap).

---

## Checkpoint Schedule

| After Phases | User Checkpoint |
|-------------|-----------------|
| 0 + 1 | "Workspace + toolchain ready. `pnpm desktop:dev` launches empty window. Continue?" |
| 2 + 3 | "Electron main/preload + renderer shell ready. App shows React UI. Continue?" |
| 4 + 5 | "Local-first data + packaging ready. Import/export works, installer builds. Continue?" |
| 6 | "CI workflows ready. Final summary." |

---

## Phase 0: Workspace Wiring

**Goal**: Create the package skeleton and wire it into the monorepo.

### Executor: `workspace-wirer` (haiku, general-purpose)

Create/modify these files:

| File | Action |
|------|--------|
| `apps/greyboard-desktop/package.json` | Create — `@feel-good/greyboard-desktop`, electron + vite + react deps |
| `apps/greyboard-desktop/tsconfig.json` | Create — extend `react-library.json` for renderer |
| `apps/greyboard-desktop/tsconfig.node.json` | Create — extend `base.json` for main/preload |
| `apps/greyboard-desktop/eslint.config.mjs` | Create — re-export `@feel-good/eslint-config/base` |
| `package.json` (root) | Modify — add `desktop:dev`, `desktop:build`, `desktop:dist`, `desktop:lint`, `desktop:check-types` scripts |
| `turbo.json` (root) | Modify — add `dist-electron/**` to build outputs |

**Key conventions** (from exploration):
- Package name: `@feel-good/greyboard-desktop`
- Workspace deps use `"workspace:*"`, catalog deps use `"catalog:"`
- ESLint for non-Next uses `@feel-good/eslint-config/base` (not `/next`)
- Engines: `"node": ">=20.9.0"`
- `packageManager: "pnpm@9.15.0"`

### Validation Loop

```
┌─────────────────────────────────────────────────┐
│ 1. Executor creates files                       │
│ 2. Validator (sonnet, Explore) reviews:         │
│    - package.json has correct name/deps/scripts │
│    - tsconfig extends correct shared configs    │
│    - eslint re-exports /base not /next          │
│    - root scripts point to correct filter       │
│    - turbo.json outputs include dist-electron   │
│ 3. If REJECTED → retry executor with feedback   │
│    (max 2 retries)                              │
│ 4. Quality gate (see below)                     │
└─────────────────────────────────────────────────┘
```

### Quality Gate

| Check | Command | Pass Criteria |
|-------|---------|---------------|
| Install | `pnpm install` | Exit 0, lockfile updated |
| Lint config | `pnpm --filter @feel-good/greyboard-desktop lint` | Exit 0 (no source files yet, should not error) |
| Root scripts | `pnpm run desktop:lint` | Resolves to correct filter |

---

## Phase 1: Toolchain Setup (Vite + esbuild)

**Goal**: Vite renderer build, esbuild main/preload build, dev orchestration.

### Executor A: `vite-configurator` (haiku, general-purpose)

| File | Action |
|------|--------|
| `apps/greyboard-desktop/vite.config.ts` | Create |
| `apps/greyboard-desktop/index.html` | Create — minimal entry for Vite |
| `apps/greyboard-desktop/src/main.tsx` | Create — minimal React mount |
| `apps/greyboard-desktop/postcss.config.mjs` | Create — `@tailwindcss/postcss` plugin |

Config requirements:
- `@vitejs/plugin-react`
- `base: "./"` (critical for file:// protocol in packaged app)
- Alias `@ -> ./src`
- Output to `dist/`

### Executor B: `esbuild-configurator` (haiku, general-purpose)

| File | Action |
|------|--------|
| `apps/greyboard-desktop/scripts/build-electron.mjs` | Create — esbuild for main + preload |
| `apps/greyboard-desktop/scripts/dev.mjs` | Create — dev orchestration (Vite server + esbuild watch + Electron restart) |
| `apps/greyboard-desktop/electron/main.ts` | Create — minimal Electron main (loads Vite dev URL or file://) |
| `apps/greyboard-desktop/electron/preload.ts` | Create — minimal preload (empty contextBridge) |

Build output:
- `electron/main.ts -> dist-electron/main.cjs`
- `electron/preload.ts -> dist-electron/preload.cjs`
- Format: CJS (Electron's main process requires it)
- Platform: `node`, external: `electron`

**Executors A and B run in parallel** (different files).

### Validation Loop

```
┌──────────────────────────────────────────────────────┐
│ 1. Both executors complete                           │
│ 2. Validator (sonnet, Explore) reviews:              │
│    - vite.config has base: "./" and React plugin     │
│    - esbuild outputs CJS to dist-electron/           │
│    - dev script orchestrates all 3 processes         │
│    - main.ts loads Vite URL in dev, file:// in prod  │
│    - preload.ts uses contextBridge correctly          │
│    - index.html has <div id="root"> and script entry │
│ 3. If REJECTED → retry with feedback (max 2)        │
│ 4. Quality gate                                      │
└──────────────────────────────────────────────────────┘
```

### Quality Gate

| Check | Command | Pass Criteria |
|-------|---------|---------------|
| Type check (renderer) | `pnpm --filter @feel-good/greyboard-desktop check-types` | Exit 0 |
| Type check (electron) | `pnpm --filter @feel-good/greyboard-desktop exec tsc --noEmit -p tsconfig.node.json` | Exit 0 |
| Lint | `pnpm --filter @feel-good/greyboard-desktop lint` | Exit 0 |
| Build renderer | `pnpm --filter @feel-good/greyboard-desktop exec vite build` | Exit 0, `dist/` populated |
| Build electron | `node apps/greyboard-desktop/scripts/build-electron.mjs` | Exit 0, `dist-electron/main.cjs` + `dist-electron/preload.cjs` exist |

**User checkpoint after Phase 0 + 1.**

---

## Phase 2: Electron Foundation

**Goal**: Full IPC handler layer with typed preload bridge and security hardening.

**Runs in parallel with Phase 3** (different directories: `electron/` vs `src/`).

### Executor: `electron-foundation` (haiku, general-purpose)

| File | Action |
|------|--------|
| `apps/greyboard-desktop/electron/main.ts` | Modify — full window lifecycle, security, IPC registration |
| `apps/greyboard-desktop/electron/preload.ts` | Modify — typed `contextBridge` exposing `window.greyboardDesktop` |
| `apps/greyboard-desktop/electron/ipc/app.ts` | Create — `getVersion`, `getPlatform` handlers |
| `apps/greyboard-desktop/electron/ipc/files.ts` | Create — `importBoard`, `exportBoard` with Zod validation |
| `apps/greyboard-desktop/electron/ipc/notifications.ts` | Create — `show` notification handler |
| `apps/greyboard-desktop/electron/ipc/updates.ts` | Create — `check`, `onStatus` handler stubs |
| `apps/greyboard-desktop/electron/ipc/index.ts` | Create — barrel registering all handlers |
| `apps/greyboard-desktop/electron/lib/validators.ts` | Create — Zod schemas for IPC payloads |

Security requirements:
- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- Validate all IPC payloads with Zod before file system operations
- Only expose approved methods via `contextBridge`

### Validation Loop

```
┌─────────────────────────────────────────────────────────┐
│ 1. Executor creates files                               │
│ 2. Validator (sonnet, Explore) reviews:                 │
│    - webPreferences has all 3 security flags             │
│    - contextBridge exposes ONLY the 7 approved methods   │
│    - Zod validation on file import/export payloads       │
│    - IPC channels use descriptive names (e.g.,           │
│      "greyboard:app:getVersion")                         │
│    - No nodeIntegration leak, no remote module           │
│    - files handler uses dialog.showOpenDialog /          │
│      dialog.showSaveDialog                               │
│ 3. If REJECTED → retry with feedback (max 2)            │
│ 4. Quality gate                                          │
└─────────────────────────────────────────────────────────┘
```

### Quality Gate

| Check | Command | Pass Criteria |
|-------|---------|---------------|
| Type check | `pnpm --filter @feel-good/greyboard-desktop exec tsc --noEmit -p tsconfig.node.json` | Exit 0 |
| Lint | `pnpm --filter @feel-good/greyboard-desktop lint` | Exit 0 |
| Security audit | Validator grep: no `nodeIntegration: true`, no `contextIsolation: false`, no `require("electron")` in renderer | All pass |

---

## Phase 3: Renderer Shell

**Goal**: Full React renderer with routing, styles, and desktop API types.

**Runs in parallel with Phase 2** (different directories: `src/` vs `electron/`).

### Executor A: `renderer-core` (haiku, general-purpose)

| File | Action |
|------|--------|
| `apps/greyboard-desktop/src/main.tsx` | Modify — full React 19 mount with router |
| `apps/greyboard-desktop/src/App.tsx` | Create — layout shell |
| `apps/greyboard-desktop/src/router.tsx` | Create — hash router with dashboard + settings |
| `apps/greyboard-desktop/src/routes/dashboard.tsx` | Create — dashboard placeholder |
| `apps/greyboard-desktop/src/routes/settings.tsx` | Create — settings placeholder |

Requirements:
- Use `createHashRouter` (required for `file://` protocol)
- React 19.2 (`createRoot`)
- Add `"use client"` is NOT needed (this is not Next.js)

### Executor B: `renderer-styles` (haiku, general-purpose)

| File | Action |
|------|--------|
| `apps/greyboard-desktop/styles/globals.css` | Create — Tailwind v4 + Radix colors + `@feel-good/ui/styles.css` + `@source` |
| `apps/greyboard-desktop/src/types/desktop-api.ts` | Create — typed `DesktopAPI` interface matching preload bridge |
| `apps/greyboard-desktop/src/types/global.d.ts` | Create — `declare global { interface Window { greyboardDesktop: DesktopAPI } }` |
| `apps/greyboard-desktop/components.json` | Create — shadcn-style config with `rsc: false` |

CSS conventions (from existing apps):
```css
@import "tailwindcss";
@import "tw-animate-css";
@import "@radix-ui/colors/gray.css";
@import "@radix-ui/colors/gray-dark.css";
@import "@feel-good/ui/styles.css";
@source "../node_modules/@feel-good/ui";
```

**Executors A and B run in parallel.**

### Validation Loop

```
┌─────────────────────────────────────────────────────────┐
│ 1. Both executors complete                              │
│ 2. Validator (sonnet, Explore) reviews:                 │
│    - Hash router used (not browser router)              │
│    - globals.css follows monorepo conventions            │
│    - DesktopAPI types match preload bridge contract      │
│    - global.d.ts augments Window correctly               │
│    - components.json has rsc: false                      │
│    - main.tsx imports globals.css                        │
│ 3. If REJECTED → retry with feedback (max 2)            │
│ 4. Quality gate                                          │
└─────────────────────────────────────────────────────────┘
```

### Quality Gate

| Check | Command | Pass Criteria |
|-------|---------|---------------|
| Type check | `pnpm --filter @feel-good/greyboard-desktop check-types` | Exit 0 |
| Lint | `pnpm --filter @feel-good/greyboard-desktop lint` | Exit 0 |
| Vite build | `pnpm --filter @feel-good/greyboard-desktop exec vite build` | Exit 0, `dist/index.html` exists |

**User checkpoint after Phase 2 + 3.**

---

## Phase 4: Local-First Data

**Goal**: Board state management, localStorage persistence, IPC file import/export wiring.

### Executor A: `state-persistence` (haiku, general-purpose)

| File | Action |
|------|--------|
| `apps/greyboard-desktop/src/state/board-store.ts` | Create — Zustand store for board state |
| `apps/greyboard-desktop/src/lib/persistence/local-storage.ts` | Create — localStorage read/write with versioning |
| `apps/greyboard-desktop/src/lib/persistence/schema.ts` | Create — `PersistedBoardV1` Zod schema |

Requirements:
- Zustand store (consistent with existing monorepo patterns — greyboard web uses Zustand)
- Auto-persist to localStorage on state changes
- Schema validates on load (graceful fallback if invalid)
- `PersistedBoardV1` type matches plan contract

### Executor B: `ipc-client` (haiku, general-purpose)

| File | Action |
|------|--------|
| `apps/greyboard-desktop/src/lib/ipc/client.ts` | Create — typed wrapper around `window.greyboardDesktop` |
| `apps/greyboard-desktop/src/routes/dashboard.tsx` | Modify — wire import/export buttons to IPC client |

Requirements:
- Client provides type-safe access with fallback for when desktop API is unavailable
- Dashboard has "Import Board" and "Export Board" actions
- Handle cancel gracefully (user closes dialog = no-op)

**Executors A and B run in parallel** (different files, except dashboard.tsx is only touched by B).

### Validation Loop

```
┌──────────────────────────────────────────────────────────────┐
│ 1. Both executors complete                                   │
│ 2. Validator (sonnet, Explore) reviews:                      │
│    - Zustand store uses correct patterns                     │
│    - localStorage persistence auto-saves                     │
│    - Zod schema matches PersistedBoardV1 contract            │
│    - IPC client checks window.greyboardDesktop exists        │
│    - Dashboard import/export handles cancel + error states   │
│    - No direct electron imports in renderer code             │
│ 3. If REJECTED → retry with feedback (max 2)                │
│ 4. Quality gate                                              │
└──────────────────────────────────────────────────────────────┘
```

### Quality Gate

| Check | Command | Pass Criteria |
|-------|---------|---------------|
| Type check (renderer) | `pnpm --filter @feel-good/greyboard-desktop check-types` | Exit 0 |
| Type check (electron) | `pnpm --filter @feel-good/greyboard-desktop exec tsc --noEmit -p tsconfig.node.json` | Exit 0 |
| Lint | `pnpm --filter @feel-good/greyboard-desktop lint` | Exit 0 |
| Full build | `pnpm --filter @feel-good/greyboard-desktop build` | Exit 0 |

---

## Phase 5: Packaging + Updates

**Goal**: electron-builder config, updater integration, app icons/resources.

### Executor: `packager` (haiku, general-purpose)

| File | Action |
|------|--------|
| `apps/greyboard-desktop/electron-builder.yml` | Create — macOS dmg + Windows nsis targets |
| `apps/greyboard-desktop/resources/` | Create — placeholder icon files (icon.png, icon.icns, icon.ico) |
| `apps/greyboard-desktop/electron/ipc/updates.ts` | Modify — wire `electron-updater` status events |
| `apps/greyboard-desktop/package.json` | Modify — add `dist` script for electron-builder |

Requirements:
- macOS targets: `dmg` for `arm64` + `x64`
- Windows targets: `nsis` for `x64`
- GitHub Releases as publish target
- `electron-updater` emits status via IPC: `checking`, `available`, `not-available`, `downloading`, `downloaded`, `error`
- `directories.output: "release/"`
- `files`: include `dist/**`, `dist-electron/**`

### Validation Loop

```
┌──────────────────────────────────────────────────────────────┐
│ 1. Executor creates files                                    │
│ 2. Validator (sonnet, Explore) reviews:                      │
│    - electron-builder.yml has correct file inclusions        │
│    - GitHub publish config present                           │
│    - macOS + Windows targets specified                       │
│    - updater IPC emits all 6 status types                    │
│    - resources/ has placeholder icons                        │
│    - package.json dist script calls electron-builder         │
│ 3. If REJECTED → retry with feedback (max 2)                │
│ 4. Quality gate                                              │
└──────────────────────────────────────────────────────────────┘
```

### Quality Gate

| Check | Command | Pass Criteria |
|-------|---------|---------------|
| Type check | Both tsconfigs pass | Exit 0 |
| Lint | `pnpm --filter @feel-good/greyboard-desktop lint` | Exit 0 |
| Full build | `pnpm --filter @feel-good/greyboard-desktop build` | Exit 0 |
| Builder config | `pnpm --filter @feel-good/greyboard-desktop exec electron-builder --help` | electron-builder installed and accessible |

**User checkpoint after Phase 4 + 5.**

---

## Phase 6: Release CI

**Goal**: GitHub Actions workflows for CI and release.

### Executor A: `ci-workflow` (haiku, general-purpose)

| File | Action |
|------|--------|
| `.github/workflows/desktop-ci.yml` | Create |

Requirements:
- Triggers on PR and push to main (paths: `apps/greyboard-desktop/**`)
- Jobs: lint, typecheck, build
- Node 20, pnpm 9
- Caches: pnpm store, turbo cache

### Executor B: `release-workflow` (haiku, general-purpose)

| File | Action |
|------|--------|
| `.github/workflows/desktop-release.yml` | Create |

Requirements:
- Triggers on tag push (`desktop-v*`)
- Matrix: macOS (arm64 + x64), Windows (x64)
- Build + sign + publish to GitHub Releases
- Required secrets: `GH_TOKEN`, macOS signing/notarization vars, Windows signing vars
- Uses `electron-builder --publish always`

**Executors A and B run in parallel.**

### Validation Loop

```
┌──────────────────────────────────────────────────────────────┐
│ 1. Both executors complete                                   │
│ 2. Validator (sonnet, Explore) reviews:                      │
│    - CI triggers on correct paths                            │
│    - Release triggers on correct tag pattern                 │
│    - Both use Node 20 + pnpm 9                               │
│    - Release matrix covers macOS arm64, macOS x64, Win x64   │
│    - Secrets are referenced, not hardcoded                   │
│    - CI does lint + typecheck + build                        │
│    - Release does build + sign + publish                     │
│ 3. If REJECTED → retry with feedback (max 2)                │
│ 4. Quality gate                                              │
└──────────────────────────────────────────────────────────────┘
```

### Quality Gate

| Check | Command | Pass Criteria |
|-------|---------|---------------|
| YAML validity | `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/desktop-ci.yml'))"` | Exit 0 |
| YAML validity | `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/desktop-release.yml'))"` | Exit 0 |
| Lint | `pnpm --filter @feel-good/greyboard-desktop lint` | Exit 0 |
| Full build | `pnpm --filter @feel-good/greyboard-desktop build` | Exit 0 |

---

## Integration Phase (Post All Phases)

After all 6 phases complete, run a final integration agent:

### Executor: `integrator` (haiku, general-purpose)

Tasks:
1. Read every barrel export (`index.ts`) and verify all public items are exported
2. Verify `package.json` export paths resolve to real files
3. Run full build: `pnpm --filter @feel-good/greyboard-desktop build`
4. Verify root scripts work: `pnpm desktop:lint`, `pnpm desktop:check-types`
5. Fix any missing or incorrect exports

### Final Quality Gate

| Check | Command | Pass Criteria |
|-------|---------|---------------|
| Full build | `pnpm --filter @feel-good/greyboard-desktop build` | Exit 0 |
| Root lint | `pnpm desktop:lint` | Exit 0 |
| Root typecheck | `pnpm desktop:check-types` | Exit 0 |
| Monorepo build | `pnpm build` | Exit 0 (no regressions) |

---

## Agent Summary

| Phase | Agent Name | Model | Type | Parallel? |
|-------|-----------|-------|------|-----------|
| 0 | workspace-wirer | haiku | general-purpose | — |
| 1 | vite-configurator | haiku | general-purpose | ✓ with B |
| 1 | esbuild-configurator | haiku | general-purpose | ✓ with A |
| 2 | electron-foundation | haiku | general-purpose | ✓ with Phase 3 |
| 3 | renderer-core | haiku | general-purpose | ✓ with Phase 2 + 3B |
| 3 | renderer-styles | haiku | general-purpose | ✓ with Phase 2 + 3A |
| 4 | state-persistence | haiku | general-purpose | ✓ with B |
| 4 | ipc-client | haiku | general-purpose | ✓ with A |
| 5 | packager | haiku | general-purpose | — |
| 6 | ci-workflow | haiku | general-purpose | ✓ with B |
| 6 | release-workflow | haiku | general-purpose | ✓ with A |
| — | integrator | haiku | general-purpose | — |

**Total executors**: 12
**Validators per phase**: 6 (one per phase, sonnet Explore)
**Overhead agents**: 1 integrator
**Grand total**: 19 agent invocations (12 executors + 6 validators + 1 integrator)

---

## Error Recovery

| Failure | Recovery |
|---------|----------|
| Validator rejects | Retry executor with feedback (max 2 retries) |
| Quality gate fails | Spawn fix agent with error output (max 1 retry), then ask user |
| Agent timeout/crash | Offer to retry that specific agent |
| pnpm install fails | Check catalog versions, fix dependency conflicts |
| Type errors across phase boundary | Re-run type check, fix at integration phase |
| Persistent failure | Stop, report partial progress, ask user |

---

## File Manifest

Complete list of files created across all phases:

```
apps/greyboard-desktop/
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── eslint.config.mjs
├── vite.config.ts
├── postcss.config.mjs
├── index.html
├── components.json
├── electron-builder.yml
├── electron/
│   ├── main.ts
│   ├── preload.ts
│   ├── lib/
│   │   └── validators.ts
│   └── ipc/
│       ├── index.ts
│       ├── app.ts
│       ├── files.ts
│       ├── notifications.ts
│       └── updates.ts
├── scripts/
│   ├── build-electron.mjs
│   └── dev.mjs
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── router.tsx
│   ├── routes/
│   │   ├── dashboard.tsx
│   │   └── settings.tsx
│   ├── state/
│   │   └── board-store.ts
│   ├── lib/
│   │   ├── persistence/
│   │   │   ├── local-storage.ts
│   │   │   └── schema.ts
│   │   └── ipc/
│   │       └── client.ts
│   └── types/
│       ├── desktop-api.ts
│       └── global.d.ts
├── styles/
│   └── globals.css
└── resources/
    ├── icon.png
    ├── icon.icns
    └── icon.ico

.github/workflows/
├── desktop-ci.yml
└── desktop-release.yml

package.json (root — modified)
turbo.json (root — modified)
```

**Total files**: 33 created, 2 modified
