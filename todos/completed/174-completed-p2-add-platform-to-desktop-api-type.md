---
status: completed
priority: p2
issue_id: "174"
tags: [greyboard-desktop, electron, types]
dependencies: []
---

# Add synchronous `platform` field to DesktopAPI interface

## Problem Statement

The `DesktopAPI` interface only exposes platform info via an async IPC call (`app.getPlatform()`). The renderer needs the platform value synchronously at startup (before React mounts) to set `data-platform` on the document element. Currently `src/main.tsx` uses the deprecated `navigator.platform` as a workaround.

## Findings

- **Location:** `apps/greyboard-desktop/electron/lib/desktop-api.ts`
- **Source:** Plan `docs/plans/2026-02-20-fix-platform-conditional-titlebar.md`

## Proposed Solution

Add `platform: NodeJS.Platform` as a top-level synchronous property on the `DesktopAPI` interface. The existing async `app.getPlatform()` stays for runtime use.

## Acceptance Criteria

- [ ] `DesktopAPI` interface includes `platform: NodeJS.Platform`
- [ ] `pnpm check-types --filter=@feel-good/greyboard-desktop` passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-20 | Created from platform-conditional titlebar plan | |
