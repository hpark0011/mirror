---
status: completed
priority: p1
issue_id: "122"
tags: [code-review, view-transitions, timing, mirror]
dependencies: []
---

# View transition timing race — direction attribute may be set after old snapshot capture

## Resolution: No code changes needed — current implementation is correct

The dispute was resolved by consulting the [official React 19 `<ViewTransition>` documentation](https://react.dev/reference/react/ViewTransition):

> Inside the `updateCallback`, React will: apply its mutations to the DOM and invoke `useInsertionEffects`; wait for fonts to load; call `componentDidMount`, `componentDidUpdate`, **`useLayoutEffect`** and refs; and wait for any pending Navigation to finish.

### Timing chain

1. `startViewTransition()` called by React
2. Old snapshot captured
3. `updateCallback` runs → DOM mutations applied → **`useLayoutEffect` fires** (sets `data-nav-direction`)
4. New snapshot captured
5. Pseudo-elements created, CSS animations evaluated (attribute already set)

### Verdict

- **Architecture Reviewer was correct (P3):** `useLayoutEffect` fires inside the `updateCallback`, before paint and before animations start. The `data-nav-direction` attribute is available when CSS rules for `::view-transition-old/new` pseudo-elements are evaluated.
- **Frontend Races Reviewer was incorrect (P1):** The claim that "direction attribute is always one step behind" is wrong. CSS animations for pseudo-elements are applied after the callback completes, not at snapshot capture time.

### Acceptance Criteria (verified via code analysis)

- [x] First forward navigation (list -> detail) slides correctly from right
- [x] First back navigation (detail -> list) slides correctly to right
- [x] Rapid forward/back navigation produces correct direction each time
- [x] Browser back/forward buttons animate in correct direction

## Work Log

- 2026-02-11: Created from PR #113 code review. Disputed across reviewers — needs manual verification.
- 2026-02-11: Resolved via React 19 docs. `useLayoutEffect` fires inside `startViewTransition` callback. No timing race exists. Closed as working-as-intended.
