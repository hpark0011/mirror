---
status: completed
priority: p2
issue_id: "157"
tags: [code-review, react, performance, mirror]
dependencies: []
---

# Reference Identity Comparison on filterState Causes Spurious selection.clear()

## Problem Statement

In `scrollable-article-list.tsx`, the effect at line 68 uses `!==` (reference identity) to compare `filter.filterState` objects. The `useLocalStorage` hook's same-tab custom event listener re-sets state with a new object reference even when the data is identical, causing `selection.clear()` to fire spuriously on every filter change (double render).

## Findings

- **Source:** kieran-typescript-reviewer, performance-oracle, architecture-strategist
- **Location:** `apps/mirror/features/articles/components/scrollable-article-list.tsx:68-71`
- **Evidence:** `useLocalStorage` dispatches custom event via queueMicrotask, listener calls `setStoredValue(customEvent.detail.newValue)` creating a new object reference with identical content.

## Proposed Solutions

### Option A: Use JSON.stringify comparison (Recommended)
- Compare `JSON.stringify(prev)` vs `JSON.stringify(current)` in the effect
- Simple, no dependency changes
- **Effort:** Small
- **Risk:** Low

### Option B: Eliminate the self-loop in useLocalStorage
- Skip custom event listener updates that originated from the same hook instance
- Fixes root cause but requires changes to shared hook
- **Effort:** Medium
- **Risk:** Low

## Acceptance Criteria

- [ ] `selection.clear()` fires exactly once per intentional filter change
- [ ] No double renders on filter toggle

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-12 | Created from PR #120 code review | 3/6 agents flagged |

## Resources

- PR: #120
- `apps/mirror/features/articles/components/scrollable-article-list.tsx:62-72`
- `apps/mirror/hooks/use-local-storage.ts:50-58`
