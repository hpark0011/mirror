---
id: FG_015
title: "Extract board domain types/config/utils into greyboard-core"
date: 2026-02-24
type: feat
status: to-do
priority: p1
description: "Move board-domain primitives (types, columns, serialization-safe domain constants, insights utilities) into the shared core package with framework-agnostic imports."
dependencies: ["FG_014"]
parent_plan_id: "2026-02-24-greyboard-desktop-web-parity-plan"
acceptance_criteria:
  - "`test -f packages/greyboard-core/src/types/board.types.ts` exits 0"
  - "`test -f packages/greyboard-core/src/config/board.config.ts` exits 0"
  - "`test -f packages/greyboard-core/src/utils/insights-utils.ts` exits 0"
  - "`rg -n '@/types/board.types|@/config/board.config|@/lib/insights-utils' apps/greyboard/features 'apps/greyboard/app/(protected)/dashboard/tasks' -g'*.ts' -g'*.tsx'` returns no matches"
  - "`pnpm --filter=@feel-good/greyboard-core check-types` exits 0"
owner_agent: "Greyboard Domain Extraction Agent"
---

# Extract board domain types/config/utils into greyboard-core

## Context

Current task domain code lives inside `apps/greyboard` and cannot be reused by desktop directly.

## Goal

Centralize board-domain types/config/utility logic in `@feel-good/greyboard-core`.

## Scope

- Move domain files into core package
- Replace web imports to consume core paths
- Ensure no Next.js-only imports remain in extracted domain modules

## Out of Scope

- UI component extraction
- Desktop state persistence

## Approach

Extract pure domain files first, then update web imports in one pass.

## Constraints

- Preserve existing board column IDs and status semantics
- Do not change runtime behavior in this ticket

## Resources

- `apps/greyboard/types/board.types.ts`
- `apps/greyboard/config/board.config.ts`
- `apps/greyboard/lib/insights-utils.ts`
