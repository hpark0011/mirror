---
id: FG_023
title: "Replace desktop router with shared task workspace route"
date: 2026-02-24
type: feat
status: to-do
priority: p1
description: "Swap desktop markdown-reader routes for a task-management route that renders the shared TaskWorkspace backed by desktop state APIs."
dependencies: ["FG_019", "FG_022"]
parent_plan_id: "2026-02-24-greyboard-desktop-web-parity-plan"
acceptance_criteria:
  - "`rg -n 'TaskWorkspace' apps/greyboard-desktop/src -g'*.tsx'` returns a match"
  - "`rg -n 'document-list|document-view|/document/:name' apps/greyboard-desktop/src/router.tsx` returns no matches"
  - "`pnpm --filter=@feel-good/greyboard-desktop check-types` exits 0"
  - "`pnpm --filter=@feel-good/greyboard-desktop build` exits 0"
owner_agent: "Desktop Routing Agent"
---

# Replace desktop router with shared task workspace route

## Context

Desktop currently routes to markdown document views, which conflicts with parity requirements.

## Goal

Make desktop route surface centered on task workspace parity with web.

## Scope

- Update desktop router to task workspace route(s)
- Wire desktop app shell to shared workspace
- Remove active usage of document-view routes

## Out of Scope

- Full file-level cleanup of old document modules
- Snapshot import/export migration details

## Approach

Replace route graph first, then follow with cleanup ticket to remove dead document code.

## Constraints

- Preserve desktop shell chrome (header, theme toggle, titlebar drag/no-drag)
- Desktop build must remain green

## Resources

- `apps/greyboard-desktop/src/router.tsx`
- `apps/greyboard-desktop/src/App.tsx`
- `apps/greyboard-desktop/src/features/header/main-header.tsx`

