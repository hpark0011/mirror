---
status: completed
priority: p3
issue_id: "111"
tags: [code-review, architecture, mirror, profile, articles]
dependencies: []
---

# Barrel Exports Over-Expose Internal Implementation Details

## Problem Statement

`features/profile/index.ts` and `features/articles/index.ts` re-export internal components like `SheetContainer`, `ProfileMedia`, and `useBottomSheet` that are only consumed within their own feature. This widens the public API surface unnecessarily.

## Findings

- **Source:** architecture-strategist, pattern-recognition-specialist agents
- **Locations:**
  - `apps/mirror/features/profile/index.ts` lines 3-5
  - `apps/mirror/features/articles/index.ts`

## Proposed Solutions

### Option A: Trim barrel to external consumers only (Recommended)

Only export types and components that are actually imported from outside the feature module. Internal components should be imported directly within the feature.

- **Effort:** Low
- **Risk:** Low — verify no cross-feature imports exist first

## Acceptance Criteria

- [x] Barrel exports limited to externally consumed items
- [x] Internal imports use direct paths within the feature

## Work Log

| Date       | Action                      | Learnings                                     |
| ---------- | --------------------------- | --------------------------------------------- |
| 2026-02-09 | Created from PR #106 review | Keep barrel exports minimal — only public API |

## Resources

- PR: https://github.com/hpark0011/feel-good/pull/106
