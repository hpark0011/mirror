---
id: FG_020
title: "Switch greyboard web tasks route to core TaskWorkspace"
date: 2026-02-24
type: refactor
status: to-do
priority: p1
description: "Update greyboard web to render the shared TaskWorkspace from greyboard-core while preserving the existing Next.js shell and route surface."
dependencies: ["FG_019", "FG_017"]
parent_plan_id: "2026-02-24-greyboard-desktop-web-parity-plan"
acceptance_criteria:
  - "`rg -n 'TaskWorkspace' 'apps/greyboard/app/(protected)/dashboard/tasks' -g'*.tsx'` returns a match"
  - "`rg -n 'LayoutModeProvider|TasksHeader|TasksBody' 'apps/greyboard/app/(protected)/dashboard/tasks/_components/tasks-view.tsx'` returns no matches"
  - "`pnpm --filter=@feel-good/greyboard check-types` exits 0"
  - "`pnpm --filter=@feel-good/greyboard build` exits 0"
owner_agent: "Web Integration Agent"
---

# Switch greyboard web tasks route to core TaskWorkspace

## Context

Web currently owns task composition directly; parity requires web to consume the same shared workspace as desktop.

## Goal

Make web tasks route a shell around core workspace, not a separate implementation.

## Scope

- Update web tasks route/components to use `TaskWorkspace`
- Keep existing route URL and app shell behavior

## Out of Scope

- Desktop app changes
- Snapshot import/export behavior changes

## Approach

Replace composition internals with core import and keep Next-only wrappers at route/layout boundaries.

## Constraints

- `/dashboard/tasks` must continue to function identically
- No change to external route contract

## Resources

- `apps/greyboard/app/(protected)/dashboard/tasks/page.tsx`
- `apps/greyboard/app/(protected)/dashboard/tasks/_components/tasks-view.tsx`
