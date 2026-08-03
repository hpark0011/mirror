---
id: FG_265
title: "Internal React peers resolve the catalog runtime"
date: 2026-08-03
type: fix
status: completed
priority: p1
description: "Align peer-only internal React workspaces with the catalog runtime so shared hooks cannot load a second React instance."
dependencies: []
acceptance_criteria:
  - "`pnpm -r list react react-dom --depth 0` reports React 19.2.8 for apps/mirror, apps/ui-factory, packages/icons, packages/ui, and packages/utils."
  - "`rg 'react@19\\.2\\.3' pnpm-lock.yaml` returns no matches."
  - "`pnpm install --frozen-lockfile`, `pnpm build`, and `pnpm lint` all exit successfully."
  - "`pnpm dedupe --check 2>&1 | rg 'packages/(icons|utils)'` returns no stale React resolution for either workspace."
owner_agent: "JavaScript dependency resolution engineer"
---

# Internal React peers resolve the catalog runtime

## Context

A dependency-upgrade code review found that `pnpm-workspace.yaml:8-9` moves the React catalog to 19.2.8 while the regenerated `pnpm-lock.yaml` still resolves the peer-only `packages/icons` and `packages/utils` workspaces to React 19.2.3. `pnpm -r list react react-dom --depth 0` and `pnpm dedupe --check` both confirm the split.

This is behaviorally relevant because `packages/utils/src/use-local-storage.ts` imports React hooks and Mirror consumes that hook from its article and post filters. Next/Turbopack aliases the current application bundles to its vendored React, but a resolver outside that boundary can load the package-local 19.2.3 runtime alongside the application's 19.2.8 renderer and fail with `Invalid hook call`.

## Goal

Every internal workspace resolves the same React 19.2.8 development runtime while preserving the libraries' broad React peer compatibility range.

## Scope

- Add catalog-backed React development dependencies to peer-only internal React workspaces that currently auto-install 19.2.3.
- Regenerate `pnpm-lock.yaml` with the repository-declared pnpm version.
- Verify dependency resolution, frozen installation, build, and lint behavior.

## Out of Scope

- Narrowing the published React peer dependency ranges.
- Upgrading unrelated direct dependencies or broadly deduplicating the lockfile.

## Approach

Keep the existing `^18.0.0 || ^19.0.0` peer contracts, add `react: "catalog:"` as a development dependency in `packages/icons/package.json` and `packages/utils/package.json`, and regenerate only the resulting lockfile resolutions.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Add catalog-backed React development dependencies to `packages/icons/package.json` and `packages/utils/package.json` without changing their peer dependency ranges.
2. Regenerate `pnpm-lock.yaml` using pnpm 9.15.0 and confirm the two importer entries resolve React 19.2.8.
3. Run the dependency-resolution acceptance checks to ensure React 19.2.3 is absent.
4. Run `pnpm install --frozen-lockfile`, `pnpm build`, and `pnpm lint`.

## Constraints

- Preserve the existing broad peer dependency API for React 18 and React 19 consumers.
- Do not include unrelated lockfile upgrades or deduplication changes.

## Resources

- Review finding: `pnpm-workspace.yaml:8-9`
- Affected runtime hook: `packages/utils/src/use-local-storage.ts`
