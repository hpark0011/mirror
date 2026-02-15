---
status: completed
priority: p3
issue_id: "195"
tags: [code-review, pr-124, seo, links]
dependencies: []
---

# Missing nofollow in link rel attribute

## Problem Statement

The Link extension is configured with `rel: "noopener noreferrer"` but doesn't include `nofollow`. For user-generated content, this means search engines will follow and pass PageRank to all linked URLs, which could be exploited for SEO spam.

## Findings

- `packages/features/editor/lib/extensions.ts` — `rel: "noopener noreferrer"` (missing `nofollow`)

## Proposed Solutions

Add `nofollow` to the rel attribute: `rel: "noopener noreferrer nofollow"`.

- Effort: Small
- Risk: Low

## Acceptance Criteria

- [ ] External links include `nofollow` in rel attribute

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-13 | Created from PR #124 code review | UGC links should include nofollow for SEO safety |
