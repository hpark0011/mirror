---
status: completed
priority: p2
issue_id: "175"
tags: [greyboard-desktop, electron, preload]
dependencies: ["174"]
---

# Expose `process.platform` synchronously in preload script

## Problem Statement

The renderer needs the real `process.platform` value at startup to set `data-platform` on the document element. The preload script has synchronous access to `process.platform` (even in sandboxed mode — documented Electron behavior) but doesn't expose it.

## Findings

- **Location:** `apps/greyboard-desktop/electron/preload.ts`
- **Source:** Plan `docs/plans/2026-02-20-fix-platform-conditional-titlebar.md`

## Proposed Solution

Add `platform: process.platform` to the `contextBridge.exposeInMainWorld` object. The `satisfies DesktopAPI` check will enforce type correctness after #174 adds the field to the interface.

## Acceptance Criteria

- [ ] `window.greyboardDesktop.platform` returns `'darwin'` / `'win32'` / `'linux'`
- [ ] Value is available synchronously (no await needed)
- [ ] `pnpm check-types --filter=@feel-good/greyboard-desktop` passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-20 | Created from platform-conditional titlebar plan | |
