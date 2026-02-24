---
title: "Greyboard Desktop/Web Parity with Local-First Desktop Persistence"
type: feat
date: 2026-02-24
scope: apps/greyboard + apps/greyboard-desktop + packages/greyboard-core
---

# Greyboard Desktop/Web Parity with Local-First Desktop Persistence

## Summary

Unify `greyboard-desktop` and `greyboard` around a shared task-management core, then make desktop use a main-process JSON store (local machine) with schema-compatible import/export between web and desktop.

## Findings (From Repo Inspection)

1. Web task app is already local-first and feature-rich, centered on `apps/greyboard/app/(protected)/dashboard/tasks/_components/tasks-body.tsx` and `apps/greyboard/features/task-board-core/hooks/use-board-state.ts`.
2. Desktop is currently markdown-reader-only via `apps/greyboard-desktop/src/routes/document-list.tsx`, `apps/greyboard-desktop/src/routes/document-view.tsx`, and `apps/greyboard-desktop/electron/ipc/docs.ts`.
3. Reuse is blocked by route-coupled imports inside features (example: `apps/greyboard/features/ticket-form/components/ticket-form-dialog.tsx`, `apps/greyboard/features/task-board-core/hooks/use-board-state.ts`).
4. Monorepo has no shared task package yet; current shared packages are `ui/features/utils/icons`.

## Scope Lock

1. Desktop becomes web-parity issue/ticket app (no markdown-reader route in this phase).
2. Desktop persistence is main-process local JSON.
3. Shared-core package strategy is required.
4. Web/Desktop data portability is required now.

## Implementation Plan

## 1. Create Shared Package: `@feel-good/greyboard-core`

1. Add `packages/greyboard-core` with exports for domain types, config, hooks, task UI, persistence contracts.
2. Move and normalize task domain modules out of app-local paths:
   Path sources include `apps/greyboard/types/board.types.ts`, `apps/greyboard/config/board.config.ts`, `apps/greyboard/lib/insights-utils.ts`, and task feature folders under `apps/greyboard/features/*`.
3. Add package dependencies in both apps:
   `apps/greyboard/package.json`, `apps/greyboard-desktop/package.json`.

## 2. Remove Route-Coupling in Task Features

1. Move route-level task hooks/components into core (or equivalent core modules):
   From `apps/greyboard/app/(protected)/dashboard/tasks/_hooks` and selected files in `apps/greyboard/app/(protected)/dashboard/tasks/_components`.
2. Replace imports that point at `@/app/(protected)/dashboard/tasks/*` with core-local imports.
3. Keep app shells thin:
   Web shell handles Next-only pieces (layout/fonts/branding), while core owns ticket-management behavior.

## 3. Define Cross-Platform Persistence Contract

1. Add core persistence interface (used by hooks/stores instead of direct localStorage access).
2. Web adapter continues using browser localStorage and existing keys.
3. Desktop adapter uses IPC-backed JSON state, exposed as storage service to core.

## 4. Implement Desktop Main-Process JSON State Store

1. Add new IPC channels and handlers in desktop electron layer:
   Update `apps/greyboard-desktop/electron/lib/channels.ts`, preload, client, and register in `apps/greyboard-desktop/electron/ipc/index.ts`.
2. Create `state` IPC module (new `apps/greyboard-desktop/electron/ipc/state.ts`) that:
   Loads/saves `greyboard-state.json` under `app.getPath('userData')`.
   Validates with Zod, uses atomic write (temp + rename), and recovers safely from corruption.
3. Keep docs IPC code out of active desktop flow for this scope (remove from router/registration path).

## 5. Replace Desktop Renderer with Parity Task App

1. Replace document routes in `apps/greyboard-desktop/src/router.tsx` with task workspace route(s) using core UI.
2. Remove markdown-reader state and hooks from active app flow:
   `apps/greyboard-desktop/src/state/document-store.ts`, document route/components.
3. Keep desktop shell concerns (titlebar drag/no-drag, window controls/theme wiring), but run the same ticket-management behavior and screens as web.

## 6. Update Web App to Consume Core

1. Web `tasks` route composes core workspace instead of app-local task feature tree.
2. Keep existing Next-specific root integration:
   `apps/greyboard/app/layout.tsx`, providers, analytics, and any Next-only image/font wrappers.
3. Ensure no behavior regression in `/dashboard/tasks`.

## 7. Data Portability (Web <-> Desktop)

1. Introduce `GreyboardSnapshotV2` (shared schema) containing board + projects + timer + relevant UI state.
2. Support legacy board-only import format currently produced by web.
3. Update import/export UI actions in both apps to read/write snapshot format and preserve compatibility.

## Public API / Interface / Type Changes

1. New package API:
   `@feel-good/greyboard-core` exports task domain types, serializers, hooks, task workspace components, and persistence contracts.
2. Desktop bridge additions in `apps/greyboard-desktop/electron/lib/desktop-api.ts`:
   `state.load()`, `state.save()`, `state.importSnapshot()`, `state.exportSnapshot()`.
3. Snapshot type:
   `GreyboardSnapshotV2` with versioned schema and migration support from legacy board-only JSON.

## Test Cases and Scenarios

1. Web regression:
   Ticket CRUD, drag/drop, project CRUD/filter, subtask edits, timer transitions, focus dialog, insights dialog, layout toggle, theme toggle, import/export.
2. Desktop parity:
   Same scenarios as web plus persistence after app restart (state reload from JSON file).
3. Portability:
   Export on web -> import on desktop (full fidelity).
   Export on desktop -> import on web (full fidelity).
   Legacy board-only JSON import still works in both.
4. Failure modes:
   Corrupt desktop JSON file, partial write interruption, invalid import payload, missing fields, large state file.
5. Build/type checks:
   `pnpm --filter=@feel-good/greyboard check-types`
   `pnpm --filter=@feel-good/greyboard-desktop check-types`
   `pnpm --filter=@feel-good/greyboard build`
   `pnpm --filter=@feel-good/greyboard-desktop build`
   `pnpm --filter=@feel-good/greyboard lint`
   `pnpm --filter=@feel-good/greyboard-desktop lint`

## Assumptions and Defaults

1. Desktop markdown-reader flow is removed from active product surface in this sync.
2. No backend/auth integration is introduced; both remain local-first.
3. Desktop local persistence source-of-truth is main-process JSON under userData.
4. Existing web localStorage data is preserved and read without destructive migration.
5. Import/export compatibility is mandatory and shipped in the same effort.
