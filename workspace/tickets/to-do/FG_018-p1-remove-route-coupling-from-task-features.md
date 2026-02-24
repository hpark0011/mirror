---
id: FG_018
title: "Remove route-level coupling from task features"
date: 2026-02-24
type: refactor
status: to-do
priority: p1
description: "Eliminate feature imports that reference `app/(protected)/dashboard/tasks/*` so task modules can run in both Next.js and Electron renderers."
dependencies: ["FG_015", "FG_017"]
parent_plan_id: "2026-02-24-greyboard-desktop-web-parity-plan"
acceptance_criteria:
  - "`rg -n '@/app/\\(protected\\)/dashboard/tasks|\\.\\./\\.\\./\\.\\./app/\\(protected\\)/dashboard/tasks' apps/greyboard/features apps/greyboard/hooks -g'*.ts' -g'*.tsx'` returns no matches"
  - "`rg -n 'from \"@/app/\\(protected\\)/dashboard/tasks/_hooks\"' apps/greyboard -g'*.ts' -g'*.tsx'` returns no matches"
  - "`pnpm --filter=@feel-good/greyboard check-types` exits 0"
  - "`pnpm --filter=@feel-good/greyboard build` exits 0"
owner_agent: "Cross-Platform Refactor Agent"
---

# Remove route-level coupling from task features

## Context

Several feature modules import route-local hooks/components, which prevents desktop from consuming the same feature layer.

## Goal

Make the task feature layer app-shell agnostic.

## Scope

- Move or replace route-coupled hooks/types/components with shared equivalents
- Update all affected imports in feature modules and hooks

## Out of Scope

- Desktop IPC
- Snapshot import/export wiring

## Approach

Promote shared functionality upward into core modules and keep route folders as thin composition layers.

## Constraints

- No behavioral regressions in web task workflows
- Keep type contracts stable where possible

## Resources

- `apps/greyboard/features/ticket-form/components/ticket-form-dialog.tsx`
- `apps/greyboard/features/task-board-core/hooks/use-board-state.ts`
- `apps/greyboard/hooks/use-persisted-sub-tasks.ts`

