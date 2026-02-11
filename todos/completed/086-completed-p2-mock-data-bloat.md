---
status: pending
priority: p2
issue_id: "086"
tags: [code-review, performance, bundle-size, mirror]
dependencies: []
---

# Mock Article Data Ships ~20KB of Unused Content to Client

## Problem Statement

`mock-articles.ts` is 282 lines / ~28KB raw. It includes `body` (multi-paragraph essays), `cover_image`, and `created_at` fields on all 30 articles. None of these fields are rendered anywhere -- the article list only uses `slug`, `title`, `category`, and `published_at`. The `[slug]` detail page shows only the slug text.

Because `page.tsx` is `"use client"` and directly imports `MOCK_ARTICLES`, the entire 28KB ships in the client JavaScript bundle (~18-20KB minified).

## Findings

- **Source:** performance-oracle, code-simplicity-reviewer agents
- **Location:** `apps/mirror/app/(protected)/dashboard/articles/_data/mock-articles.ts`
- **Evidence:** `ArticleListItem` only renders `title`, `category`, `published_at`. `ArticleListView` has no body/image column. 28 articles with full prose bodies when 12 would suffice for infinite scroll demo (page size is 10).

## Proposed Solutions

### Option A: Strip unused fields and reduce count (Recommended)
- Remove `body`, `cover_image`, `created_at` from type and data
- Reduce from 28 to ~12 articles (enough for one full page + partial second)
- **Pros:** ~70% reduction in file size, cleaner type, YAGNI-compliant
- **Cons:** Need to re-add fields when detail page is built
- **Effort:** Small
- **Risk:** Low

### Option B: Keep full data but lazy-load
- Split body content into separate file, import only in detail page
- **Pros:** Preserves data for future use
- **Cons:** More files, premature optimization
- **Effort:** Medium
- **Risk:** Low

## Recommended Action

Option A -- strip unused fields.

## Technical Details

- **Affected files:** `apps/mirror/app/(protected)/dashboard/articles/_data/mock-articles.ts`
- **Estimated reduction:** ~220 lines

## Acceptance Criteria

- [ ] `Article` type only includes `slug`, `title`, `category`, `published_at`
- [ ] Mock data reduced to ~12 articles
- [ ] Bundle size reduced
- [ ] Build passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-08 | Created from PR #105 code review | Unused fields in client-shipped mock data waste bandwidth |

## Resources

- PR: https://github.com/hpark0011/feel-good/pull/105
