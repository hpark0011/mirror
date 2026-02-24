---
id: FG_016
title: "Add GreyboardSnapshotV2 schema and legacy board migrator"
date: 2026-02-24
type: feat
status: to-do
priority: p1
description: "Create a shared, versioned snapshot schema for web/desktop data portability and add deterministic migration from legacy board-only JSON exports."
dependencies: ["FG_014", "FG_015"]
parent_plan_id: "2026-02-24-greyboard-desktop-web-parity-plan"
acceptance_criteria:
  - "`test -f packages/greyboard-core/src/persistence/snapshot.ts` exits 0"
  - "`rg -n 'export interface GreyboardSnapshotV2|version:\\s*2' packages/greyboard-core/src/persistence/snapshot.ts` returns matches"
  - "`rg -n 'migrateLegacyBoard|fromLegacyBoard' packages/greyboard-core/src/persistence/snapshot.ts` returns a match"
  - "`rg -n 'zod|safeParse|parse' packages/greyboard-core/src/persistence/snapshot.ts` returns a match"
  - "`pnpm --filter=@feel-good/greyboard-core check-types` exits 0"
owner_agent: "Data Portability Agent"
---

# Add GreyboardSnapshotV2 schema and legacy board migrator

## Context

Web currently exports board-only JSON, while desktop parity requires a full state snapshot that can round-trip between apps.

## Goal

Define and enforce a shared snapshot contract with backward compatibility.

## Scope

- Add `GreyboardSnapshotV2` schema/types
- Add migration function from legacy board-only format
- Export serializer/deserializer helpers from core

## Out of Scope

- Wiring import/export buttons in apps
- Desktop IPC storage

## Approach

Use versioned schema with explicit migration entrypoint and deterministic parse/validation behavior.

## Constraints

- Must not break existing legacy imports
- Snapshot parsing must fail closed for invalid payloads

## Resources

- `apps/greyboard/features/task-board-core/utils/board-storage.utils.ts`
- `apps/greyboard/features/task-board-core/utils/board-io.utils.ts`

