---
status: completed
priority: p2
issue_id: "202"
tags: [code-review, pr-124, architecture, typescript, editor]
dependencies: []
---

# tsconfig.json does not include editor directory for type checking

## Problem Statement

The `packages/features/tsconfig.json` may not include the new `editor/` directory in its `include` paths, which means standalone `tsc --noEmit` type checking of the features package would skip editor files. Type errors in the editor package would only surface when a consuming app (Mirror) builds.

## Findings

- **Location:** `packages/features/tsconfig.json`
- The editor directory was added in this PR but the tsconfig may not have been updated
- Consumer apps inherit types transitively through Next.js builds, masking the gap
- Standalone type checking (`tsc --noEmit` in the features package) would miss editor type errors

## Proposed Solutions

### Option A: Add editor to tsconfig include (Recommended)

Ensure the `include` array covers the editor directory:

```json
{
  "include": ["auth/**/*.ts", "auth/**/*.tsx", "dock/**/*.ts", "dock/**/*.tsx", "editor/**/*.ts", "editor/**/*.tsx", "theme/**/*.ts", "theme/**/*.tsx"]
}
```

Or use a simpler glob: `"include": ["**/*.ts", "**/*.tsx"]`

- **Effort:** Small
- **Risk:** Low

## Acceptance Criteria

- [x] Running `tsc --noEmit` in `packages/features/` type-checks editor files
- [x] No new type errors are introduced
- [x] CI type checking covers the editor package

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-13 | Created from PR #124 architecture review | New feature directories must be included in tsconfig for standalone type checking |
| 2026-02-13 | Fixed: broadened include to `**/*.ts`, `**/*.tsx` | Simpler glob avoids needing to update tsconfig for each new feature directory |
