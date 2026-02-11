---
status: completed
priority: p2
issue_id: "124"
tags: [code-review, dead-code, mirror]
dependencies: []
---

# Remove commented-out duplicate import in article-detail-view.tsx

## Problem Statement

Line 3 of `article-detail-view.tsx` has a commented-out duplicate of the `formatLongDate` import that already exists on line 1. This is dead code that should not ship.

## Findings

- Flagged by all reviewers (TypeScript, Pattern Recognition, Code Simplicity, Architecture)
- Pre-existing on `main` but this PR touches the file, so it should be cleaned up
- One-line fix

## Proposed Solutions

### Delete line 3

Remove `// import { formatLongDate } from "../lib/format-date";`

- **Effort:** Small (1 line)
- **Risk:** None

## Technical Details

- **Affected files:** `apps/mirror/features/articles/views/article-detail-view.tsx` (line 3)

## Acceptance Criteria

- [ ] No commented-out imports remain in the file
- [ ] `pnpm lint --filter=@feel-good/mirror` passes

## Work Log

- 2026-02-11: Created from PR #113 code review.

## Resources

- PR #113: https://github.com/hpark0011/feel-good/pull/113
