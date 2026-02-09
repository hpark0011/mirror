---
status: completed
priority: p3
issue_id: "105"
tags: [code-review, consistency, mirror]
dependencies: []
---

# Duplicate Transition Easing Constant Between Hook and Component

## Problem Statement

The cubic-bezier `(0.32, 0.72, 0, 1)` appears in both `use-bottom-sheet.ts` (as JS string) and `sheet-container.tsx` (as Tailwind arbitrary value). If the easing changes, it must be updated in two places.

## Findings

- **Source:** pattern-recognition-specialist agent
- **Location:** `use-bottom-sheet.ts` lines 62, 74; `sheet-container.tsx` line 24

## Proposed Solutions

### Option A: Extract to shared constant (Recommended)
- **Effort:** Small
- **Risk:** Low

## Acceptance Criteria

- [ ] Single source of truth for easing curve
- [ ] Both hook and component reference same constant

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-09 | Created from PR #105 round 2 review | Extract duplicated magic values |

## Resources

- PR: https://github.com/hpark0011/feel-good/pull/105
