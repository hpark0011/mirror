---
status: completed
priority: p2
issue_id: "123"
tags: [code-review, view-transitions, correctness, mirror]
dependencies: []
---

# Fragile direction heuristic — doesn't compare previous vs current path

## Problem Statement

The navigation direction detection uses a simple `pathname.startsWith("/dashboard/articles/")` check without comparing the previous pathname. The `prevPathname` ref is tracked but never used in the direction decision. This produces incorrect results for several navigation scenarios.

## Findings

- **TypeScript Reviewer (P1):** Article-to-article navigation classified as "forward" (should be lateral). Non-article dashboard routes classified as "back" (incorrect).
- **Frontend Races Reviewer (P2):** Hard-coded path check breaks silently when routes are added.
- **Architecture Reviewer (P2):** Silent regression risk as dashboard routing expands.
- **Pattern Recognition (P2):** Duplicates logic already in `dashboard-header.tsx:15`.

**Current code:**
```ts
const isForward = pathname.startsWith("/dashboard/articles/");
```

**Problem scenarios:**
1. `/dashboard/articles/foo` -> `/dashboard/articles/bar` = "forward" (should be lateral/none)
2. `/dashboard` -> `/dashboard/settings` = "back" (should be none)
3. `prevPathname` ref is stored but unused in the decision

## Proposed Solutions

### Option A: Compare previous and current paths

```ts
const wasArticleDetail = prevPathname.current.startsWith("/dashboard/articles/");
const isArticleDetail = pathname.startsWith("/dashboard/articles/");

if (isArticleDetail && !wasArticleDetail) {
  document.documentElement.dataset.navDirection = "forward";
} else if (!isArticleDetail && wasArticleDetail) {
  document.documentElement.dataset.navDirection = "back";
}
// else: no direction set (lateral navigation gets default crossfade)
```

- **Pros:** Correctly handles list<->detail transitions, ignores lateral moves
- **Cons:** Still hardcodes the `/dashboard/articles/` prefix
- **Effort:** Small
- **Risk:** Low

### Option B: Depth-comparison model

```ts
const prevDepth = prevPathname.current.split("/").length;
const nextDepth = pathname.split("/").length;
const isForward = nextDepth > prevDepth;
```

- **Pros:** Generalizes to any route hierarchy without hardcoding
- **Cons:** Lateral navigation at same depth defaults to "back"
- **Effort:** Small
- **Risk:** Low

## Recommended Action

Option A — it correctly handles the current use case and avoids false positives from article-to-article navigation.

## Technical Details

- **Affected files:** `apps/mirror/app/(protected)/dashboard/_components/use-nav-direction.ts`
- **Related:** `dashboard-header.tsx:15` has the same `startsWith` check (potential for shared utility)

## Acceptance Criteria

- [ ] List -> detail = "forward" slide
- [ ] Detail -> list = "back" slide
- [ ] Article -> different article = no directional slide (crossfade or instant)
- [ ] Non-article dashboard routes don't produce incorrect direction

## Work Log

- 2026-02-11: Created from PR #113 code review. Agreed upon by 4 of 7 reviewers.

## Resources

- PR #113: https://github.com/hpark0011/feel-good/pull/113
