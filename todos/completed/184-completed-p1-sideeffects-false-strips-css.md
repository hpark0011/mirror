---
status: completed
priority: p1
issue_id: "184"
tags: [code-review, pr-124, editor, css, bundler]
dependencies: []
---

# sideEffects: false may strip editor CSS

## Problem Statement

`packages/features/package.json` has `"sideEffects": false` which tells bundlers that all modules are pure and can be tree-shaken. However, `editor/styles/tiptap-content.css` is a side-effect-only import (CSS files have no exports). Bundlers like webpack/Turbopack may drop it silently, causing unstyled Tiptap content in production builds.

## Findings

- `packages/features/package.json:6` — `"sideEffects": false`
- `apps/mirror/styles/globals.css:25` — imports `tiptap-content.css` via `../node_modules/` path
- CSS is consumed via `@import` in globals.css, but the flag still signals to bundlers that the CSS file is droppable

## Proposed Solutions

### Option A: Add sideEffects array (Recommended)

Change `"sideEffects": false` to `"sideEffects": ["**/*.css"]` in `packages/features/package.json`. This preserves tree-shaking for JS while protecting CSS imports.

- Effort: Small
- Risk: Low

### Option B: Remove sideEffects flag entirely

Remove the `"sideEffects"` field. Slightly larger bundles but zero risk of CSS being dropped.

- Effort: Small
- Risk: Low (slightly larger bundles)

## Acceptance Criteria

- [ ] CSS file is not tree-shaken in production builds
- [ ] `pnpm build --filter=@feel-good/mirror` succeeds
- [ ] Tiptap content renders with correct styles in production

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-13 | Created from PR #124 code review | sideEffects: false + CSS imports is a common bundler footgun |
