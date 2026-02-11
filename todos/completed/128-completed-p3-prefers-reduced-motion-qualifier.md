---
status: completed
priority: p3
issue_id: "128"
tags: [code-review, accessibility, css, mirror]
dependencies: []
---

# prefers-reduced-motion missing `: reduce` qualifier

## Problem Statement

The `@media (prefers-reduced-motion)` query in `globals.css` is missing the `: reduce` value. The bare media query matches when the feature is simply supported by the browser, which could disable animations for users who have not opted into reduced motion.

## Findings

- **TypeScript Reviewer (P3):** The correct form is `@media (prefers-reduced-motion: reduce)`

## Proposed Solutions

### Fix the media query

```css
@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) {
    animation: none !important;
  }
}
```

- **Effort:** Small (1 word change)
- **Risk:** None

## Technical Details

- **Affected files:** `apps/mirror/styles/globals.css` (line 63)

## Acceptance Criteria

- [ ] Media query correctly targets only users who prefer reduced motion

## Work Log

- 2026-02-11: Created from PR #113 code review.

## Resources

- PR #113: https://github.com/hpark0011/feel-good/pull/113
- [MDN: prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)
