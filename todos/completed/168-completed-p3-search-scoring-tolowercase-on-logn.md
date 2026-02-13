---
status: completed
priority: p3
issue_id: "168"
tags: [code-review, performance, mirror]
dependencies: []
---

# Search Scoring Calls .toLowerCase() O(N log N) Times

## Problem Statement

In `use-article-search.ts`, the filter pass calls `.toLowerCase()` 3 times per article, then the sort comparator calls it again up to 3*2*N*log(N) times. `.body.toLowerCase()` is the expensive call since body contains full article text.

## Findings

- **Location:** `apps/mirror/features/articles/hooks/use-article-search.ts:30-49`

## Proposed Solutions

Single-pass approach: compute lowercased fields and score in one loop, then sort by precomputed score. Reduces `.toLowerCase()` from O(N log N) to O(N).

- **Effort:** Small

## Acceptance Criteria

- [ ] Each article's fields are lowercased at most once per search pass

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-12 | Created from PR #120 code review | |
