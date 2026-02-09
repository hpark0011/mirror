---
status: completed
priority: p2
issue_id: "108"
tags: [code-review, duplication, mirror, profile]
dependencies: []
---

# Easing String Duplication Between Hook and Component

## Problem Statement

The easing curve `cubic-bezier(0.32, 0.72, 0, 1)` is defined as `SHEET_EASING` in `use-bottom-sheet.ts:11` for JS animations, but is also hardcoded as a Tailwind class `ease-[cubic-bezier(0.32,0.72,0,1)]` in `sheet-container.tsx:27`. If one changes, the other could silently drift.

## Findings

- **Source:** pattern-recognition-specialist, code-simplicity-reviewer agents
- **Locations:**
  - `apps/mirror/features/profile/hooks/use-bottom-sheet.ts` line 11
  - `apps/mirror/features/profile/components/sheet-container.tsx` line 27

## Proposed Solutions

### Option A: Extract shared easing constant (Recommended)
Export `SHEET_EASING` from a shared `lib/constants.ts` and derive the Tailwind class from it, or add a comment cross-referencing the source of truth.
- **Effort:** Low
- **Risk:** None

### Option B: Add cross-reference comment
Add a comment in `sheet-container.tsx` pointing to `SHEET_EASING` as the source of truth.
- **Effort:** Trivial
- **Risk:** Comments can go stale

## Acceptance Criteria

- [x] Single source of truth for the easing curve value
- [x] No silent drift possible between JS and CSS animations

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-09 | Created from PR #106 review | Keep animation constants DRY across JS and Tailwind |
| 2026-02-09 | Completed: Option A — extracted `SHEET_EASING` to `features/profile/lib/constants.ts` | Derive Tailwind arbitrary class from constant with `.replace(/ /g, "")` to strip spaces |

## Resources

- PR: https://github.com/hpark0011/feel-good/pull/106
