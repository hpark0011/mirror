---
id: FG_022
title: "Add desktop state preload and renderer client bridge"
date: 2026-02-24
type: feat
status: done
priority: p1
description: "Expose desktop state IPC methods through preload and typed renderer client wrappers so core workspace can consume desktop persistence safely."
dependencies: ["FG_021"]
parent_plan_id: "2026-02-24-greyboard-desktop-web-parity-plan"
acceptance_criteria:
  - "`rg -n 'state:' apps/greyboard-desktop/electron/preload.ts apps/greyboard-desktop/src/lib/ipc/client.ts apps/greyboard-desktop/electron/lib/desktop-api.ts` returns 3 matches"
  - "`rg -n 'STATE_LOAD|STATE_SAVE|STATE_IMPORT|STATE_EXPORT' apps/greyboard-desktop/electron/preload.ts` returns matches"
  - "`rg -n 'load\\(|save\\(|importSnapshot\\(|exportSnapshot\\(' apps/greyboard-desktop/src/lib/ipc/client.ts` returns matches"
  - "`pnpm --filter=@feel-good/greyboard-desktop check-types` exits 0"
owner_agent: "Electron Bridge Agent"
---

# Add desktop state preload and renderer client bridge

## Context

Main-process persistence is not usable until preload and renderer APIs expose it in a type-safe way.

## Goal

Add typed state bridge in `DesktopAPI`, preload, and renderer client wrapper.

## Scope

- Extend desktop API interface
- Expose new state methods in preload
- Add client wrapper methods in renderer

## Out of Scope

- Route/UI wiring to task workspace
- Removing old document routes

## Approach

Mirror existing IPC client patterns and keep fallbacks deterministic when desktop API is unavailable.

## Constraints

- Maintain `contextIsolation: true` safety model
- Preserve current app startup behavior

## Resources

- `apps/greyboard-desktop/electron/lib/desktop-api.ts`
- `apps/greyboard-desktop/electron/preload.ts`
- `apps/greyboard-desktop/src/lib/ipc/client.ts`
