---
status: completed
priority: p1
issue_id: "176"
tags: [greyboard-desktop, electron, bug]
dependencies: []
---

# Gate BrowserWindow title bar options by platform

## Problem Statement

`electron/main.ts` applies `titleBarStyle: 'hidden'`, `trafficLightPosition`, and `titleBarOverlay` unconditionally. On Windows, the `titleBarOverlay` renders native caption buttons (minimize/maximize/close) in the top-right corner. These overlap the right-aligned ThemeToggle since no CSS compensation exists for Windows. `trafficLightPosition` is macOS-only and a no-op elsewhere.

## Findings

- **Location:** `apps/greyboard-desktop/electron/main.ts:38-40`
- **Source:** Plan `docs/plans/2026-02-20-fix-platform-conditional-titlebar.md`
- **Severity:** High — ThemeToggle is unclickable on Windows

## Proposed Solution

Gate the options using `process.platform`:

```typescript
const isMac = process.platform === 'darwin'
const isWindows = process.platform === 'win32'

// titleBarStyle: 'hidden' stays unconditional
...(isMac && { trafficLightPosition: { x: 16, y: 14 } }),
...(isWindows && { titleBarOverlay: { color: '#00000000', height: 48 } }),
```

## Acceptance Criteria

- [ ] `trafficLightPosition` only applied on macOS
- [ ] `titleBarOverlay` only applied on Windows
- [ ] `titleBarStyle: 'hidden'` remains on all platforms
- [ ] `pnpm build --filter=@feel-good/greyboard-desktop` passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-20 | Created from platform-conditional titlebar plan | |
