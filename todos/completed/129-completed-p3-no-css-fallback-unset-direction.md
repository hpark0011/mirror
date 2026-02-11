---
status: completed
priority: p3
issue_id: "129"
tags: [code-review, view-transitions, css, mirror]
dependencies: ["122"]
---

# No CSS fallback when data-nav-direction is unset

## Problem Statement

All four view transition CSS rules are gated behind `html[data-nav-direction="forward"]` or `html[data-nav-direction="back"]`. If a view transition fires without the attribute set (edge case, first load, or non-article route), the browser falls back to its default crossfade. This may be intentional but is not explicitly documented.

## Findings

- **Code Simplicity Reviewer (P1 -> P3):** Should be an explicit decision — either add a fallback rule or add a comment clarifying the intent

## Proposed Solutions

### Option A: Add a comment clarifying intentional fallback

```css
/* When data-nav-direction is unset, browser's default crossfade applies */
```

- **Effort:** Small
- **Risk:** None

### Option B: Add explicit default rule

```css
::view-transition-old(dashboard-content),
::view-transition-new(dashboard-content) {
  animation: none;
}
```

- **Effort:** Small
- **Risk:** Low — changes behavior for edge cases

## Technical Details

- **Affected files:** `apps/mirror/styles/globals.css`

## Acceptance Criteria

- [ ] Behavior when `data-nav-direction` is unset is explicitly documented or handled

## Work Log

- 2026-02-11: Created from PR #113 code review. Depends on #122 timing issue resolution.

## Resources

- PR #113: https://github.com/hpark0011/feel-good/pull/113
