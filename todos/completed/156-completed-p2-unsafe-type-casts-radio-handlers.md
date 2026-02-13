---
status: completed
priority: p2
issue_id: "156"
tags: [code-review, typescript, type-safety, mirror]
dependencies: []
---

# Unsafe Type Assertions in Radio Group Handlers

## Problem Statement

`date-filter-content.tsx` and `status-filter-content.tsx` use `as` casts (`val as DatePreset`, `val as "draft" | "published"`) to bypass TypeScript safety on Radix `onValueChange` callbacks. The sort dropdown already has a proper `isSortOrder()` type guard — the filter dropdowns should follow the same pattern.

## Findings

- **Source:** kieran-typescript-reviewer, security-sentinel, pattern-recognition-specialist, performance-oracle
- **Location:** `apps/mirror/features/articles/components/filter/date-filter-content.tsx:22`, `apps/mirror/features/articles/components/filter/status-filter-content.tsx:22`
- **Evidence:** Sort dropdown at `article-sort-dropdown.tsx:26` has `isSortOrder()` guard; filter dropdowns do not.

## Proposed Solutions

### Option A: Add type guards (Recommended)
- Create `isDatePreset()` and `isPublishedStatus()` type guards
- Derive `DatePreset` from a const array for single source of truth
- **Effort:** Small
- **Risk:** Low

### Option B: Validate via Set lookup
- Use `new Set(["today", "this_week", ...]).has(val)` inline
- **Effort:** Small
- **Risk:** Low

## Acceptance Criteria

- [ ] No `as` casts in radio group handlers
- [ ] Runtime validation matches the sort dropdown pattern
- [ ] TypeScript still correctly narrows the types

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-12 | Created from PR #120 code review | 4/6 agents flagged |
| 2026-02-13 | Implemented type guards following sort dropdown pattern | Added `isDatePreset()` and `isPublishedStatus()` guards |

## Resources

- PR: #120
- Pattern reference: `apps/mirror/features/articles/components/article-sort-dropdown.tsx:26`
