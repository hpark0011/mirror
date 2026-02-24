---
id: FG_014
title: "Scaffold @feel-good/greyboard-core workspace package"
date: 2026-02-24
type: feat
status: to-do
priority: p1
description: "Create the new shared task-management package and wire it into the monorepo so both greyboard web and desktop can consume it."
dependencies: []
parent_plan_id: "2026-02-24-greyboard-desktop-web-parity-plan"
acceptance_criteria:
  - "`test -d packages/greyboard-core` exits 0"
  - "`test -f packages/greyboard-core/package.json` exits 0"
  - "`node -e \"console.log(require('./packages/greyboard-core/package.json').name)\"` outputs `@feel-good/greyboard-core`"
  - "`rg -n '\"@feel-good/greyboard-core\": \"workspace:\\*\"' apps/greyboard/package.json apps/greyboard-desktop/package.json` returns 2 matches"
  - "`pnpm --filter=@feel-good/greyboard-core check-types` exits 0"
owner_agent: "Monorepo Foundations Agent"
---

# Scaffold @feel-good/greyboard-core workspace package

## Context

The desktop/web parity plan requires a shared core package for task-management logic. The repository currently has no `packages/greyboard-core`.

## Goal

Create a compile-ready shared package with initial exports and workspace wiring.

## Scope

- Create package directory, `package.json`, `tsconfig`, and base `src/index.ts`
- Add `@feel-good/greyboard-core` dependency to both app package manifests
- Ensure package is discoverable by pnpm workspace and typecheckable

## Out of Scope

- Moving feature/domain code into the package
- App runtime integration

## Approach

Add a minimal but valid package shell first, then use follow-up tickets for domain extraction and integration.

## Constraints

- Must remain TypeScript strict-mode compatible
- Must not break current app builds

## Resources

- `docs/plans/2026-02-24-greyboard-desktop-web-parity-plan.md`
- `pnpm-workspace.yaml`
- `apps/greyboard/package.json`
- `apps/greyboard-desktop/package.json`

