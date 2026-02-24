---
id: FG_024
title: "Remove desktop markdown document-reader codepath"
date: 2026-02-24
type: refactor
status: done
priority: p2
description: "Delete obsolete markdown-reader routes/state/ipc channels from greyboard-desktop after task-workspace migration to reduce maintenance and prevent divergence."
dependencies: ["FG_023"]
parent_plan_id: "2026-02-24-greyboard-desktop-web-parity-plan"
acceptance_criteria:
  - "`test ! -e apps/greyboard-desktop/src/routes/document-list.tsx` exits 0"
  - "`test ! -e apps/greyboard-desktop/src/routes/document-view.tsx` exits 0"
  - "`test ! -e apps/greyboard-desktop/src/state/document-store.ts` exits 0"
  - "`rg -n 'DOCS_SELECT_FOLDER|DOCS_GET_FOLDER|DOCS_LIST_FILES|DOCS_READ_FILE' apps/greyboard-desktop` returns no matches"
  - "`pnpm --filter=@feel-good/greyboard-desktop build` exits 0"
owner_agent: "Desktop Cleanup Agent"
---

# Remove desktop markdown document-reader codepath

## Context

After desktop task routing is in place, document-reader modules become dead code and create product drift risk.

## Goal

Fully remove obsolete markdown-reader implementation from desktop.

## Scope

- Delete document routes and store modules
- Remove docs IPC channels and handlers
- Remove stale docs API methods from preload/client/type interfaces

## Out of Scope

- Reintroducing a docs feature as optional tab
- Task workspace behavior changes

## Approach

Do hard cleanup after route migration is stable to keep repository intent unambiguous.

## Constraints

- Do not break desktop task workspace runtime
- Keep desktop build and typecheck deterministic

## Resources

- `apps/greyboard-desktop/src/routes/document-list.tsx`
- `apps/greyboard-desktop/src/routes/document-view.tsx`
- `apps/greyboard-desktop/electron/ipc/docs.ts`
