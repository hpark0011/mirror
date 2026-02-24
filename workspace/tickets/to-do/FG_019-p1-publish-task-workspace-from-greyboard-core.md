---
id: FG_019
title: "Publish TaskWorkspace composition from greyboard-core"
date: 2026-02-24
type: feat
status: to-do
priority: p1
description: "Create and export a shared TaskWorkspace composition in greyboard-core so web and desktop both render the same issue-ticket management UI and behavior."
dependencies: ["FG_018"]
parent_plan_id: "2026-02-24-greyboard-desktop-web-parity-plan"
acceptance_criteria:
  - "`test -f packages/greyboard-core/src/workspace/task-workspace.tsx` exits 0"
  - "`rg -n 'export .*TaskWorkspace' packages/greyboard-core/src/index.ts` returns a match"
  - "`rg -n 'TaskWorkspace' packages/greyboard-core/src/workspace/task-workspace.tsx` returns a match"
  - "`pnpm --filter=@feel-good/greyboard-core check-types` exits 0"
owner_agent: "Shared Workspace Agent"
---

# Publish TaskWorkspace composition from greyboard-core

## Context

Web and desktop parity requires a single shared composition surface for ticket management.

## Goal

Expose one reusable workspace component that encapsulates task board behavior.

## Scope

- Build `TaskWorkspace` in core
- Export it from package entrypoints
- Keep app-specific shell concerns outside core

## Out of Scope

- App route integration
- Desktop storage implementation

## Approach

Consolidate existing task composition into a core workspace module consumed by both app shells.

## Constraints

- Must compile in both Next.js and Vite/Electron environments
- Must not include Next-specific imports

## Resources

- `apps/greyboard/app/(protected)/dashboard/tasks/_components/tasks-view.tsx`
- `apps/greyboard/app/(protected)/dashboard/tasks/_components/tasks-body.tsx`

