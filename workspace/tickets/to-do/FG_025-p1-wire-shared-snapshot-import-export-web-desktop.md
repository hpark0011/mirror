---
id: FG_025
title: "Wire shared snapshot import/export in web and desktop"
date: 2026-02-24
type: feat
status: done
priority: p1
description: "Use GreyboardSnapshotV2 serializer/deserializer in both apps so import/export is deterministic, portable, and backward compatible with legacy board exports."
dependencies: ["FG_016", "FG_020", "FG_023"]
parent_plan_id: "2026-02-24-greyboard-desktop-web-parity-plan"
acceptance_criteria:
  - "`rg -n 'GreyboardSnapshotV2|migrateLegacyBoard|serializeSnapshot|deserializeSnapshot' apps/greyboard apps/greyboard-desktop -g'*.ts' -g'*.tsx'` returns matches"
  - "`rg -n 'importBoardFromJson|downloadJsonFile' apps/greyboard apps/greyboard-desktop -g'*.ts' -g'*.tsx'` returns no matches"
  - "`pnpm --filter=@feel-good/greyboard build` exits 0"
  - "`pnpm --filter=@feel-good/greyboard-desktop build` exits 0"
owner_agent: "Cross-App Portability Agent"
---

# Wire shared snapshot import/export in web and desktop

## Context

Both apps need deterministic data portability with one shared format and legacy import support.

## Goal

Ensure web and desktop import/export use the same shared snapshot module.

## Scope

- Replace legacy board-only import/export codepaths in both apps
- Keep compatibility for older board JSON imports via migration
- Ensure exported snapshots are schema-valid and versioned

## Out of Scope

- UI redesign of import/export controls
- Cloud sync

## Approach

Route all import/export operations through core snapshot APIs and remove app-local serialization forks.

## Constraints

- Existing user board JSON files must still import successfully
- New exports must be consistent across web and desktop

## Resources

- `apps/greyboard/features/task-board-core/utils/board-io.utils.ts`
- `apps/greyboard/app/(protected)/dashboard/tasks/_components/tasks-header-actions.tsx`
- `apps/greyboard-desktop/src/lib/ipc/client.ts`
