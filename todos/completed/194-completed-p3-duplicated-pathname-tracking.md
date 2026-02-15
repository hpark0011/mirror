---
status: completed
priority: p3
issue_id: "194"
tags: [code-review, pr-124, hooks, duplication]
dependencies: []
---

# Duplicated pathname tracking in nav direction and scroll memory

## Problem Statement

Both `useNavDirection` and `useScrollMemory` independently track `usePathname()` and maintain `prevPathname` refs. This duplicates the same logic and both use `isArticleDetailRoute()` to determine navigation direction.

## Findings

- `apps/mirror/hooks/use-nav-direction.ts` — tracks pathname, compares with prevPathname ref
- `apps/mirror/hooks/use-scroll-memory.ts` — tracks pathname, compares with prevPathname ref
- Both import/use `isArticleDetailRoute`

## Proposed Solutions

Extract a shared `usePathnameTransition()` hook that tracks prev/current pathname and exposes the transition type (list-to-detail, detail-to-list, same). Both hooks consume this.

- Effort: Small
- Risk: Low

## Acceptance Criteria

- [ ] Single source of pathname transition tracking
- [ ] Both hooks still function correctly

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-13 | Created from PR #124 code review | DRY up pathname tracking logic |
