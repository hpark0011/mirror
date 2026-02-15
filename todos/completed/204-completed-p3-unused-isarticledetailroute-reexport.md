---
status: completed
priority: p3
issue_id: "204"
tags: [code-review, pr-124, cleanup, mirror]
dependencies: []
---

# Unused isArticleDetailRoute re-export in use-nav-direction.ts

## Problem Statement

`use-nav-direction.ts` re-exports `isArticleDetailRoute` from `use-pathname-transition.ts`, but no consumer imports it from that location. The function is already exported from its source module. This dead re-export adds confusion about where the canonical import should come from.

## Findings

- **Location:** `apps/mirror/hooks/use-nav-direction.ts`
- `isArticleDetailRoute` is defined in `use-pathname-transition.ts` and re-exported from `use-nav-direction.ts`
- No files import `isArticleDetailRoute` from `use-nav-direction`
- Consumers import directly from `use-pathname-transition`

## Proposed Solutions

### Option A: Remove the re-export (Recommended)

Delete the re-export line from `use-nav-direction.ts`.

- **Effort:** Small
- **Risk:** Low

## Acceptance Criteria

- [x] `isArticleDetailRoute` is no longer re-exported from `use-nav-direction.ts`
- [x] All existing imports still resolve correctly
- [x] Build passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-13 | Created from PR #124 simplicity review | Dead re-exports create ambiguity about canonical import paths |
| 2026-02-15 | Removed re-export, build verified | — |
