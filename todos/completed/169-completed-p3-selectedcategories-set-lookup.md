---
status: completed
priority: p3
issue_id: "169"
tags: [code-review, performance, mirror]
dependencies: []
---

# selectedCategories.includes() is O(N*M)

## Problem Statement

`category-filter-list.tsx` checks `selectedCategories.includes(category.name)` for every category. This is O(N*M) where N is total categories and M is selected categories. Converting to a Set would make it O(N).

## Findings

- **Location:** `apps/mirror/features/articles/components/filter/category-filter-list.tsx:29`

## Proposed Solutions

Convert `selectedCategories` to a `Set<string>` in the parent or at the component level. Use `.has()` instead of `.includes()`.

- **Effort:** Trivial

## Acceptance Criteria

- [ ] Category selection check uses Set.has() instead of Array.includes()

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-12 | Created from PR #120 code review | |
