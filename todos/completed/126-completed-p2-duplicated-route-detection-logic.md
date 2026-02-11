---
status: completed
priority: p2
issue_id: "126"
tags: [code-review, dry, mirror]
dependencies: ["123"]
---

# Duplicated route-detection logic between dashboard-header and use-nav-direction

## Problem Statement

Both `dashboard-header.tsx:15` and `use-nav-direction.ts:12` independently compute the same condition:

```ts
// dashboard-header.tsx
const isArticleDetail = pathname.startsWith("/dashboard/articles/");

// use-nav-direction.ts
const isForward = pathname.startsWith("/dashboard/articles/");
```

Both call `usePathname()` independently and apply the identical string prefix check. If more article sub-routes are added later, only one might get updated, causing subtle inconsistency.

## Findings

- **Pattern Recognition (P2):** Classic DRY violation with divergence risk
- The `DashboardShell` already calls `useNavDirection()` and renders `DashboardHeader` — the derived state could be shared

## Proposed Solutions

### Option A: Have useNavDirection return the derived state

```ts
export function useNavDirection() {
  // ... existing logic ...
  return { isArticleDetail: pathname.startsWith("/dashboard/articles/") };
}
```

Then pass `isArticleDetail` as a prop to `DashboardHeader`.

- **Pros:** Single source of truth, no extra hook call in header
- **Cons:** Changes the hook's return type, adds prop threading
- **Effort:** Small
- **Risk:** Low

### Option B: Extract shared route utility

```ts
// dashboard route utils
export const isArticleDetailRoute = (path: string) =>
  path.startsWith("/dashboard/articles/");
```

- **Pros:** Reusable, no API change to either component
- **Cons:** Another file to maintain
- **Effort:** Small
- **Risk:** Low

## Recommended Action

Depends on outcome of #123 (direction heuristic fix). If the heuristic changes, the shared logic should reflect the new approach.

## Technical Details

- **Affected files:**
  - `apps/mirror/app/(protected)/dashboard/_components/use-nav-direction.ts`
  - `apps/mirror/app/(protected)/dashboard/_components/dashboard-header.tsx`
  - `apps/mirror/app/(protected)/dashboard/_components/dashboard-shell.tsx` (if prop threading)

## Acceptance Criteria

- [ ] Route detection logic exists in exactly one place
- [ ] Both header visibility and nav direction use the same source

## Work Log

- 2026-02-11: Created from PR #113 code review.

## Resources

- PR #113: https://github.com/hpark0011/feel-good/pull/113
