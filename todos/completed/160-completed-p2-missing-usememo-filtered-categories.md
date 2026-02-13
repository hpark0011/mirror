---
status: completed
priority: p2
issue_id: "160"
tags: [code-review, react, performance, mirror]
dependencies: []
---

# Missing useMemo on filteredCategories Computation

## Problem Statement

In `category-filter-content.tsx`, `filteredCategories` is computed on every render despite `allCategories` (its source) being memoized with `useMemo`. This inconsistency means the derivation re-runs unnecessarily when parent state changes that don't affect `searchQuery` or `allCategories`.

## Findings

- **Source:** kieran-typescript-reviewer, performance-oracle, code-simplicity-reviewer
- **Location:** `apps/mirror/features/articles/components/filter/category-filter-content.tsx:31-33`
- **Evidence:** `allCategories` is wrapped in `useMemo` (line 26-29) but the `.filter()` derivation is not.

## Proposed Solutions

### Option A: Wrap in useMemo (Recommended)
```typescript
const filteredCategories = useMemo(() => {
  const query = searchQuery.toLowerCase();
  return allCategories.filter((c) => c.name.toLowerCase().includes(query));
}, [allCategories, searchQuery]);
```
- **Effort:** Trivial
- **Risk:** None

## Acceptance Criteria

- [ ] `filteredCategories` only recomputes when `allCategories` or `searchQuery` changes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-12 | Created from PR #120 code review | 3/6 agents flagged |

## Resources

- PR: #120
