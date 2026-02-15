---
status: completed
priority: p2
issue_id: "191"
tags: [code-review, pr-124, css, imports, monorepo]
dependencies: ["184"]
---

# Direct node_modules CSS import path is fragile

## Problem Statement

`apps/mirror/styles/globals.css` imports Tiptap styles via `../node_modules/@feel-good/features/editor/styles/tiptap-content.css`. This relative path into `node_modules` is fragile — it breaks if the dependency is hoisted differently or if the directory structure changes.

## Findings

- `apps/mirror/styles/globals.css:25` — `@import "../node_modules/@feel-good/features/editor/styles/tiptap-content.css"`
- Comment explains PostCSS needs `style` condition which package exports don't provide
- This is a known limitation of CSS `@import` with monorepo package exports

## Proposed Solutions

### Option A: Add CSS export to package.json (Recommended)

Add `"./editor/styles"` to package.json exports with `style` condition:

```json
"./editor/styles": {
  "style": "./editor/styles/tiptap-content.css",
  "default": "./editor/styles/tiptap-content.css"
}
```

Then import as `@import "@feel-good/features/editor/styles"`.

- Effort: Small
- Risk: Low (needs testing with PostCSS/Tailwind)

### Option B: Keep with better documentation

If the package exports approach doesn't work with PostCSS, keep the direct path but add a comment explaining why and pin the path structure.

- Effort: Small
- Risk: Medium (still fragile)

## Acceptance Criteria

- [ ] CSS import works reliably across installs
- [ ] No relative node_modules path if possible
- [ ] PostCSS can resolve the import

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-13 | Created from PR #124 code review | PostCSS @import doesn't support package.json exports conditions well |
