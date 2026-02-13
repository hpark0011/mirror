---
status: completed
priority: p2
issue_id: "158"
tags: [code-review, react, correctness, mirror]
dependencies: ["155"]
---

# Side Effects Inside useState Updater in useLocalStorage

## Problem Statement

The `setValue` callback in `useLocalStorage` performs `localStorage.setItem()` and `window.dispatchEvent()` inside `setStoredValue((current) => { ... })`. React's useState updater should be a pure function. React Strict Mode may call updaters multiple times, causing duplicate localStorage writes and cascading custom events (up to 4 render cycles per user action in dev mode, 2 in production).

## Findings

- **Source:** kieran-typescript-reviewer, performance-oracle, code-simplicity-reviewer
- **Location:** `apps/mirror/hooks/use-local-storage.ts:66-114`
- **Evidence:** Strict Mode double-invokes updaters. Each invocation writes to localStorage and queues a microtask event.

## Proposed Solutions

### Option A: Move side effects to useEffect (Recommended)
- Keep updater pure: only compute new value
- Sync to localStorage via `useEffect` watching `storedValue`
- **Effort:** Small
- **Risk:** Low

### Option B: Simplify entire hook (if addressed with #155)
- If simplifying for mirror-only use, restructure side effects as part of the rewrite
- **Effort:** Small (bundled with #155)
- **Risk:** Low

## Acceptance Criteria

- [ ] No side effects inside useState updater functions
- [ ] localStorage stays in sync with React state
- [ ] No double-write in React Strict Mode

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-12 | Created from PR #120 code review | 3/6 agents flagged |

## Resources

- PR: #120
- React docs on updater purity: https://react.dev/reference/react/useState#updating-state-based-on-the-previous-state
