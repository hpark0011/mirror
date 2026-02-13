---
status: completed
priority: p2
issue_id: "162"
tags: [code-review, performance, mirror]
dependencies: []
---

# getDateRange() Called Inside Filter Loop

## Problem Statement

`filterArticles` calls `getDateRange(filter.publishedDatePreset)` and `getDateRange(filter.createdDatePreset)` inside the `.filter()` callback, executing once per article. Each call creates 2 Date objects. With both date filters active, this allocates up to 6N Date objects per filter pass.

## Findings

- **Source:** performance-oracle, code-simplicity-reviewer
- **Location:** `apps/mirror/features/articles/utils/article-filter.ts:33-49`
- **Evidence:** `getDateRange` is called inside `articles.filter((article) => { ... })` on lines 34 and 44.

## Proposed Solutions

### Option A: Hoist outside the loop (Recommended)
- Compute date ranges once before the filter loop
- Convert to timestamps for fast numeric comparison
- Reduces allocation from O(6N) to O(2N+4)
- **Effort:** Small
- **Risk:** None

## Acceptance Criteria

- [x] `getDateRange` is called at most once per active date filter, not per article
- [x] Filter behavior unchanged

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-12 | Created from PR #120 code review | 2/6 agents flagged |
| 2026-02-13 | Hoisted getDateRange() calls outside filter loop, convert to timestamps | IIFE pattern for single evaluation |

## Resources

- PR: #120
- `apps/mirror/features/articles/utils/date-preset.ts`
