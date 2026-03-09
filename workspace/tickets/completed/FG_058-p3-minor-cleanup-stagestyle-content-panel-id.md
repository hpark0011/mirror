---
id: FG_058
title: "Minor cleanups: stageStyle allocation and CONTENT_PANEL_ID location"
date: 2026-03-09
type: refactor
status: completed
priority: p3
description: "Two minor cleanups from PR #193 review: vinyl-record.tsx passes stageStyle={{}} creating a new object each render (should be a module constant), and CONTENT_PANEL_ID is exported from workspace-chrome-context.tsx but is a DOM concern owned by desktop-workspace.tsx (should be co-located there)."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "grep 'stageStyle={}' apps/mirror/components/animated-geometries/vinyl-record.tsx returns 0 matches"
  - "CONTENT_PANEL_ID is defined in desktop-workspace.tsx, not exported from workspace-chrome-context.tsx"
  - "pnpm build --filter=@feel-good/mirror succeeds"
owner_agent: "Code cleanup specialist"
---

# Minor cleanups: stageStyle allocation and CONTENT_PANEL_ID location

## Context

Two minor issues from the PR #193 code review:

1. `apps/mirror/components/animated-geometries/vinyl-record.tsx:13` passes `stageStyle={{}}` which creates a new object on every render. Should be a module-level constant.

2. `apps/mirror/app/[username]/_providers/workspace-chrome-context.tsx` exports `CONTENT_PANEL_ID`, but this is a DOM detail owned by `DesktopWorkspace`. It should be defined in `desktop-workspace.tsx` and passed into the provider value (which it already does).

## Goal

No unnecessary object allocations in vinyl-record, and CONTENT_PANEL_ID lives where it belongs.

## Scope

- Extract `stageStyle={{}}` to a module-level constant in vinyl-record.tsx
- Move `CONTENT_PANEL_ID` from workspace-chrome-context.tsx to desktop-workspace.tsx

## Out of Scope

- Making stageStyle optional in GeometryScene (would be a separate change)
- Restructuring the workspace chrome context

## Approach

Define `const EMPTY_STAGE_STYLE = {} as const` at module level in vinyl-record.tsx. Move `CONTENT_PANEL_ID` constant to desktop-workspace.tsx, remove the export from workspace-chrome-context.tsx, and update imports.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. In `vinyl-record.tsx`, add `const EMPTY_STAGE_STYLE = {} as const` and use it in the JSX
2. Move `CONTENT_PANEL_ID` from `workspace-chrome-context.tsx` to `desktop-workspace.tsx`
3. Update the import in `desktop-workspace.tsx` (remove from the context import)
4. Remove the export from `workspace-chrome-context.tsx`
5. Run `pnpm build --filter=@feel-good/mirror`

## Constraints

- Must not change any runtime behavior

## Resources

- `apps/mirror/components/animated-geometries/vinyl-record.tsx:13`
- `apps/mirror/app/[username]/_providers/workspace-chrome-context.tsx:9`
