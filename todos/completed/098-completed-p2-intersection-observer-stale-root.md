---
status: completed
priority: p2
issue_id: "098"
tags: [code-review, race-condition, mirror]
dependencies: []
---

# IntersectionObserver Root Stale When scrollContainerRef.current Changes

## Problem Statement

`ArticleListLoader` passes `scrollContainerRef` (a ref object) in the `useEffect` dependency array. Since ref object identity is stable, the effect never re-runs when `.current` changes from `null` to a DOM element. On mobile, the IntersectionObserver is created with `root: null` (viewport) instead of the bottom sheet's scroll container, breaking infinite scroll.

## Findings

- **Source:** julik-frontend-races-reviewer, architecture-strategist agents
- **Location:** `apps/mirror/app/(protected)/dashboard/articles/_components/article-list-loader.tsx` line 32 (root) and line 41 (deps)
- **Evidence:** `scrollContainerRef` in deps array is stable ref object. `.current` changes don't trigger re-run.

## Proposed Solutions

### Option A: Callback ref with state (Recommended)
```typescript
const [scrollRoot, setScrollRoot] = useState<HTMLElement | null>(null);
const scrollContainerCallback = useCallback((el: HTMLElement | null) => {
  setScrollRoot(el);
}, []);
// Use scrollRoot as observer root
```
- **Effort:** Medium
- **Risk:** Low

### Option B: Remove scrollContainerRef from deps, use ref.current in effect body
- Simpler but still won't re-run when ref populates
- **Effort:** Small
- **Risk:** Medium (observer may use wrong root on first mount)

## Acceptance Criteria

- [ ] IntersectionObserver uses correct scroll container root on mobile
- [ ] Observer recreated when scroll container changes
- [ ] Infinite scroll works on mobile viewport

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-09 | Created from PR #105 round 2 review | Ref objects in deps arrays don't trigger on .current changes |

## Resources

- PR: https://github.com/hpark0011/feel-good/pull/105
