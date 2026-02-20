# Fix: Platform-conditional title bar config for greyboard-desktop

## Context

The Electron BrowserWindow in `electron/main.ts` applies `titleBarStyle: 'hidden'`, `trafficLightPosition`, and `titleBarOverlay` unconditionally on all platforms. The CSS in `styles/globals.css` only compensates for macOS (80px left padding for traffic lights). On Windows, the native caption buttons (minimize/maximize/close) rendered by `titleBarOverlay` overlap the right-aligned ThemeToggle — making one or both unclickable.

Secondary issue: `src/main.tsx` uses deprecated `navigator.platform` for detection, collapsing all non-Mac to `'win32'`. The preload already has access to `process.platform` synchronously.

## Changes (5 files)

### 1. `electron/lib/desktop-api.ts` — Add `platform` to type

Add a synchronous `platform` field to the `DesktopAPI` interface:

```ts
export interface DesktopAPI {
  platform: NodeJS.Platform
  app: { ... }
  // rest unchanged
}
```

### 2. `electron/preload.ts` — Expose `process.platform` synchronously

Add `platform: process.platform` to the `contextBridge.exposeInMainWorld` object. This is available synchronously in sandboxed preloads (documented Electron behavior).

```ts
contextBridge.exposeInMainWorld('greyboardDesktop', {
  platform: process.platform,
  app: { ... },
  // rest unchanged
} satisfies DesktopAPI)
```

### 3. `electron/main.ts` — Gate BrowserWindow options by platform

```ts
const isMac = process.platform === 'darwin'
const isWindows = process.platform === 'win32'

mainWindow = new BrowserWindow({
  // ...
  titleBarStyle: 'hidden',
  ...(isMac && { trafficLightPosition: { x: 16, y: 14 } }),
  ...(isWindows && { titleBarOverlay: { color: '#00000000', height: 48 } }),
  // ...
})
```

`titleBarStyle: 'hidden'` stays unconditional — it's the core requirement for a custom titlebar on all platforms.

### 4. `src/main.tsx` — Use preload value instead of `navigator.platform`

```ts
function initPlatform() {
  const platform = window.greyboardDesktop?.platform ?? 'unknown'
  document.documentElement.dataset.platform = platform
}
```

### 5. `styles/globals.css` — Add Windows padding-right

```css
[data-platform="darwin"] .titlebar-padded {
  padding-left: 80px;
}

[data-platform="win32"] .titlebar-padded {
  padding-right: 140px;
}
```

140px clears the ~138px Windows caption button area. CSS specificity of `[data-platform] .titlebar-padded` overrides Tailwind's `px-4`.

## Verification

1. `pnpm check-types --filter=@feel-good/greyboard-desktop` — types compile
2. `pnpm build --filter=@feel-good/greyboard-desktop` — builds cleanly
3. `pnpm dev --filter=@feel-good/greyboard-desktop` — on macOS: traffic lights visible with left padding, ThemeToggle right-aligned with normal padding
4. Visual inspection of the header layout to confirm ThemeToggle is not clipped
