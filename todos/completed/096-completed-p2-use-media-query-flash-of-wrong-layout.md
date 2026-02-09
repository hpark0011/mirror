---
status: completed
priority: p2
issue_id: "096"
tags: [code-review, ux, hydration, mirror, ui]
dependencies: []
---

# useMediaQuery Initializes to `false` Causing Flash of Wrong Layout on Mobile

## Problem Statement

`useMediaQuery` initializes `matches` to `false`. On mobile devices, the first render shows the desktop layout, then after `useEffect` fires, it switches to the mobile layout. This causes a visible layout shift (FOWL - Flash Of Wrong Layout) where the entire component tree tears down and rebuilds.

Additionally, `useMediaQuery` duplicates functionality with existing `useIsMobile` in `packages/ui/src/hooks/use-mobile.ts`.

## Findings

- **Source:** julik-frontend-races-reviewer, architecture-strategist, performance-oracle agents
- **Location:** `packages/ui/src/hooks/use-media-query.tsx` line 6; `apps/mirror/app/(protected)/dashboard/_components/dashboard-content.tsx` line 21
- **Evidence:** `useState(false)` means mobile users see desktop layout for first frame. `useIsMobile` already exists with similar logic but initializes to `undefined`.

## Proposed Solutions

### Option A: Lazy initializer with window check (Recommended)
```typescript
const [matches, setMatches] = useState(() =>
  typeof window !== "undefined" ? window.matchMedia(query).matches : false
);
```
And consolidate `useIsMobile` to use `useMediaQuery` internally.
- **Effort:** Small
- **Risk:** Low (may cause hydration warning, mitigated with `suppressHydrationWarning`)

### Option B: CSS-only responsive layout
- Render both layouts with `hidden md:block` / `md:hidden` classes
- Eliminates JS media query entirely
- **Effort:** Medium
- **Risk:** Low

## Acceptance Criteria

- [ ] No visible layout flash on mobile first load
- [ ] `useIsMobile` consolidated or documented as deprecated
- [ ] Build passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-09 | Created from PR #105 round 2 review | Initialize media query with window check for client-first rendering |

## Resources

- PR: https://github.com/hpark0011/feel-good/pull/105
