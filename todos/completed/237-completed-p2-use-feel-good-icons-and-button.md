---
status: completed
priority: p2
issue_id: "237"
tags: [code-review, patterns, greyboard-desktop]
dependencies: []
---

# Use @feel-good/icons and @feel-good/ui Button Component

## Problem Statement

Four inline SVG icon components (~54 lines) are defined in route files instead of using `@feel-good/icons` (already a dependency). All buttons use raw `<button>` with hand-written Tailwind instead of `<Button>` from `@feel-good/ui/primitives/button`.

Both packages are declared as dependencies but unused in this feature.

## Findings

- **Pattern Recognition**: Highest-severity pattern violation — icons and buttons inconsistent with monorepo.
- **Simplicity Reviewer**: ~54 lines of inline SVGs can be replaced with 4 imports.

**Affected files:**
- `apps/greyboard-desktop/src/routes/document-list.tsx` (FolderIcon, FileIcon, RefreshIcon + all buttons)
- `apps/greyboard-desktop/src/routes/document-view.tsx` (ArrowLeftIcon + back button)

## Proposed Solutions

### Option A: Replace with package components (Recommended)
**Icons:** Import from `@feel-good/icons`:
- `FolderIcon` → `FolderFillIcon`
- `FileIcon` → `DocFillIcon`
- `RefreshIcon` → `ArrowClockwiseIcon`
- `ArrowLeftIcon` → `ArrowBackwardIcon`

**Buttons:** Import `Button` from `@feel-good/ui/primitives/button`:
- Primary buttons → `<Button>` (default variant)
- Outline buttons → `<Button variant="outline">`
- Icon buttons → `<Button variant="ghost" size="icon-xs">`
- Link-style buttons → `<Button variant="link" size="xs">`

- **Effort**: Small-Medium
- **Risk**: Low

## Acceptance Criteria

- [ ] No inline SVG icon components in route files
- [ ] All buttons use `<Button>` from `@feel-good/ui`
- [ ] Consistent with other apps (mirror, greyboard)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-19 | Identified via code review (dd1cb50b) | `@feel-good/icons` has matching icons, `@feel-good/ui` has Button with CVA variants |
