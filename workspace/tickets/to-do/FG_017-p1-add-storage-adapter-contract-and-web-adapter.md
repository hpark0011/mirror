---
id: FG_017
title: "Add storage adapter contract and web localStorage adapter"
date: 2026-02-24
type: feat
status: to-do
priority: p1
description: "Introduce persistence abstraction in core and provide web implementation backed by browser localStorage, removing direct storage reads/writes from shared logic."
dependencies: ["FG_014", "FG_015", "FG_016"]
parent_plan_id: "2026-02-24-greyboard-desktop-web-parity-plan"
acceptance_criteria:
  - "`test -f packages/greyboard-core/src/persistence/storage-adapter.ts` exits 0"
  - "`rg -n 'interface .*StorageAdapter|loadSnapshot|saveSnapshot' packages/greyboard-core/src/persistence/storage-adapter.ts` returns matches"
  - "`test -f apps/greyboard/lib/persistence/web-storage-adapter.ts` exits 0"
  - "`rg -n 'localStorage' packages/greyboard-core/src` returns no matches"
  - "`pnpm --filter=@feel-good/greyboard check-types` exits 0"
owner_agent: "Persistence Abstraction Agent"
---

# Add storage adapter contract and web localStorage adapter

## Context

Core logic currently assumes browser storage in multiple places, blocking desktop reuse.

## Goal

Separate core state behavior from storage implementation details.

## Scope

- Add adapter interfaces in core package
- Add web adapter for localStorage-backed persistence
- Update web integration points to use adapter

## Out of Scope

- Desktop JSON persistence
- IPC APIs

## Approach

Inject storage behavior via explicit adapter contract and keep browser specifics outside core package.

## Constraints

- Core package must remain storage-backend agnostic
- Existing web runtime behavior must remain unchanged

## Resources

- `apps/greyboard/hooks/use-local-storage.ts`
- `packages/utils/src/use-local-storage.ts`

