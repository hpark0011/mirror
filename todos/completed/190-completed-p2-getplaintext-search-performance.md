---
status: completed
priority: p2
issue_id: "190"
tags: [code-review, pr-124, search, performance]
dependencies: []
---

# getPlainText() called per-article per-keystroke in search

## Problem Statement

`useArticleSearch` calls `getPlainText(article.body)` for every article on every search keystroke. For 28 mock articles this is negligible, but with real content (100+ articles with complex JSONContent trees), this becomes a performance bottleneck since the function recursively traverses the entire content tree each time.

## Findings

- `apps/mirror/features/articles/hooks/use-article-search.ts` — `getPlainText(article.body).toLowerCase()` inside `useMemo` filter
- `packages/features/editor/lib/get-plain-text.ts` — recursive traversal, no caching
- useMemo dependency is `[articles, searchTerm]` so it runs on every keystroke

## Proposed Solutions

### Option A: Pre-compute plain text (Recommended)

Compute `plainText` once when articles are loaded/created and store alongside the article data. Search filters against the pre-computed string.

- Effort: Small
- Risk: Low

### Option B: Memoize getPlainText with WeakMap

Use a WeakMap keyed by JSONContent object reference to cache results.

- Effort: Small
- Risk: Low (cache invalidation relies on referential stability)

## Acceptance Criteria

- [ ] Search performance doesn't degrade with article count
- [ ] getPlainText not called redundantly on each keystroke
- [ ] Search results remain accurate

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-13 | Created from PR #124 code review | Recursive content extraction + per-keystroke = O(n*m) per key |
