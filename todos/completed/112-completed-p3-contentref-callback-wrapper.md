---
status: completed
priority: p3
issue_id: "112"
tags: [code-review, simplicity, mirror, profile]
dependencies: []
---

# contentRef Callback Ref Wrapper May Be Unnecessary

## Problem Statement

In `use-bottom-sheet.ts`, a callback ref wraps `setContentElement` to pipe the DOM node into state. Since `useState` setters are already stable functions, the `useCallback` wrapper around `setContentElement` adds no value — the setter can be passed directly as the ref.

## Findings

- **Source:** code-simplicity-reviewer agent
- **Location:** `apps/mirror/features/profile/hooks/use-bottom-sheet.ts`

## Proposed Solutions

### Option A: Pass setter directly as ref (Recommended)
- **Effort:** Trivial
- **Risk:** None

## Acceptance Criteria

- [x] Remove unnecessary useCallback wrapper if present
- [x] Verify state updates still work correctly

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-09 | Created from PR #106 review | useState setters are stable — no need for useCallback wrapper |
| 2026-02-09 | Replaced `useCallback` wrapper with direct `setContentElement` assignment | — |

## Resources

- PR: https://github.com/hpark0011/feel-good/pull/106
