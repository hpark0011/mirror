---
status: completed
priority: p3
issue_id: "199"
tags: [code-review, pr-124, search, performance, editor]
dependencies: []
---

# Search reparses rich-text bodies on each query

## Problem Statement

`useArticleSearch` calls `getPlainText(article.body)` inside query-time filtering. That re-traverses each rich-text JSON tree on every debounced keystroke, causing unnecessary repeated work as article count and body complexity grow.

## Findings

- **Location:** `apps/mirror/features/articles/hooks/use-article-search.ts:37`
- `getPlainText(article.body).toLowerCase()` runs for every article in every filter pass.
- The extracted plain text is derivable once per `articles` change and reused.

## Proposed Solutions

### Option A: Precompute plain text map (Recommended)

Use `useMemo` keyed by `articles` to compute `{ slug, bodyLower }` (or similar) once, then filter against precomputed values.

- **Effort:** Small
- **Risk:** Low

### Option B: Cache in `getPlainText` with `WeakMap`

Memoize parsed output by JSONContent object identity to avoid repeated deep traversal.

- **Effort:** Small
- **Risk:** Medium (depends on referential stability)

## Acceptance Criteria

- [x] Search no longer reparses article body JSON on every keystroke
- [x] Search results and ranking remain unchanged
- [x] Behavior stays stable for both draft and published article lists

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-13 | Created from PR #124 review findings | Recursive rich-text extraction should be computed once per dataset, not per query |
| 2026-02-15 | Implemented Option A: precomputed `searchableArticles` memo | Separate `useMemo` keyed on `articles` avoids re-parsing; filtering memo reads precomputed values |
