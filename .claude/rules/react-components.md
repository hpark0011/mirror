---
paths:
  - "apps/greyboard/**/*.tsx"
  - "packages/**/*.tsx"
---

# React Component Rules

## Component Size

Components should be under ~100 lines. Extract when exceeding 100 lines, having 3+ useMemo/useCallback for business logic, or logic is reusable/needs testing.

## Anti-Patterns

- **Never use setTimeout for rendering timing.** Fix the synchronization mechanism (Suspense, view-transition-name isolation, startTransition) rather than racing a timer.
