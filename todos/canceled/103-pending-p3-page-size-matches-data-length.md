---
status: pending
priority: p3
issue_id: "103"
tags: [code-review, testing, mirror]
dependencies: []
---

# PAGE_SIZE=30 Matches Mock Data Length Making Infinite Scroll Dead Code

## Problem Statement

`useArticleList` has `PAGE_SIZE = 30` and `MOCK_ARTICLES` has exactly 30 entries. On first render, `hasMore = 30 < 30 = false`, so the infinite scroll sentinel is never rendered and the IntersectionObserver never fires. The entire pagination infrastructure is untestable.

## Findings

- **Source:** performance-oracle, code-simplicity-reviewer, kieran-typescript-reviewer agents
- **Location:** `articles/_hooks/use-article-list.ts` line 6; `articles/_data/mock-articles.ts` (30 articles)

## Proposed Solutions

### Option A: Reduce PAGE_SIZE to 10 (Recommended)
- **Effort:** Trivial (one line change)
- **Risk:** Low

## Acceptance Criteria

- [ ] Infinite scroll actually triggers with mock data
- [ ] PAGE_SIZE < mock data count

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-09 | Created from PR #105 round 2 review | Ensure test data exercises code paths |

## Resources

- PR: https://github.com/hpark0011/feel-good/pull/105
