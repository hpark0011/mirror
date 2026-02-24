---
id: FG_021
title: "Add desktop main-process JSON state IPC store"
date: 2026-02-24
type: feat
status: done
priority: p1
description: "Implement desktop local persistence in Electron main process using a versioned JSON file under userData and expose it through new IPC channels."
dependencies: ["FG_014", "FG_016"]
parent_plan_id: "2026-02-24-greyboard-desktop-web-parity-plan"
acceptance_criteria:
  - "`test -f apps/greyboard-desktop/electron/ipc/state.ts` exits 0"
  - "`rg -n 'STATE_LOAD|STATE_SAVE|STATE_IMPORT|STATE_EXPORT' apps/greyboard-desktop/electron/lib/channels.ts` returns matches"
  - "`rg -n \"greyboard-state.json|app.getPath\\('userData'\\)\" apps/greyboard-desktop/electron/ipc/state.ts` returns a match"
  - "`rg -n 'writeFile|rename|safeParse|safeParseAsync|parse' apps/greyboard-desktop/electron/ipc/state.ts` returns matches"
  - "`pnpm --filter=@feel-good/greyboard-desktop exec tsc --noEmit -p tsconfig.node.json` exits 0"
owner_agent: "Electron Persistence Agent"
---

# Add desktop main-process JSON state IPC store

## Context

Desktop parity requires local-machine persistence controlled by the Electron main process, not renderer localStorage.

## Goal

Provide robust JSON-backed state load/save/import/export operations through IPC.

## Scope

- Add IPC handlers for state operations
- Add channels/constants and handler registration
- Validate payloads and protect against malformed/corrupt state

## Out of Scope

- Renderer integration
- Desktop route/UI migration

## Approach

Use userData JSON as source-of-truth and atomic writes for deterministic persistence semantics.

## Constraints

- No direct renderer filesystem access
- Invalid state payloads must fail deterministically

## Resources

- `apps/greyboard-desktop/electron/ipc/index.ts`
- `apps/greyboard-desktop/electron/lib/channels.ts`
- `apps/greyboard-desktop/electron/lib/validators.ts`
