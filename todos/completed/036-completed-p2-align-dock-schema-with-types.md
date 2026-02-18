---
status: completed
priority: p2
issue_id: "036"
tags: [code-review, dock, validation, types]
dependencies: []
---

# Align Dock Zod Schema With Types and README

## Problem Statement

The zod schema allows configs that violate the published types/README, which can lead to runtime state issues (e.g., `activeAppId` being undefined).

## Findings

**Source:** Code review

**Affected Files:**
- `packages/features/dock/lib/schemas/dock.schema.ts`
- `packages/features/dock/lib/types.ts`
- `packages/features/dock/README.md`

**Details:**
- `defaultAppId` is optional in the schema but required in types/README.
- `icon` is required in types/README but not validated in the schema.

## Proposed Solutions

### Option A: Make schema strict to match types (Recommended)
- Require `defaultAppId` in `dockConfigSchema`.
- Add `icon` to `dockAppSchema` using `z.custom()` or `z.any()` with documentation.
- **Pros:** Prevents invalid configs
- **Cons:** Adds a custom validator for component types
- **Effort:** Small
- **Risk:** Low

### Option B: Relax types/README to match schema
- Make `defaultAppId` optional in `DockConfig` and handle fallback in provider.
- Remove `icon` requirement from types/README or document as optional.
- **Pros:** Less validation complexity
- **Cons:** Weaker guarantees, more null handling in UI
- **Effort:** Medium
- **Risk:** Medium

## Recommended Action

Align schema to the current types/README by requiring `defaultAppId` and validating `icon`.

## Acceptance Criteria

- [ ] `dockConfigSchema` requires `defaultAppId`
- [ ] `dockAppSchema` validates `icon` presence
- [ ] Schema, types, and README agree on required fields

## Work Log

| Date | Action | Outcome |
|------|--------|---------|
| 2026-02-04 | Created from code review | Pending |
| 2026-02-05 | Made defaultAppId required, added icon validation to dockAppSchema | Done |
