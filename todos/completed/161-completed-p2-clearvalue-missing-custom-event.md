---
status: completed
priority: p2
issue_id: "161"
tags: [code-review, react, correctness, mirror]
dependencies: ["155"]
---

# clearValue in useLocalStorage Missing Custom Event Dispatch

## Problem Statement

`clearValue` in `useLocalStorage` calls `localStorage.removeItem(key)` and `setStoredValue(initialValue)` but does not dispatch the `local-storage-change` custom event. If multiple components in the same tab consume the same localStorage key, only the calling component will update. Other same-tab consumers remain stale.

## Findings

- **Source:** kieran-typescript-reviewer, code-simplicity-reviewer
- **Location:** `apps/mirror/hooks/use-local-storage.ts:120-129`
- **Evidence:** `setValue` dispatches custom event via queueMicrotask (lines 95-101), but `clearValue` does not.

## Proposed Solutions

### Option A: Add custom event dispatch to clearValue (Recommended)
- Add `queueMicrotask(() => window.dispatchEvent(...))` after `setStoredValue(initialValue)`
- **Effort:** Trivial
- **Risk:** None

### Option B: Address as part of hook simplification (#155)
- If the hook is simplified to ~40 lines and cross-tab sync is removed, this becomes moot
- **Effort:** None (bundled)
- **Risk:** None

## Acceptance Criteria

- [ ] `clearValue` triggers sync for all same-tab consumers of the key

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-12 | Created from PR #120 code review | 2/6 agents flagged |

## Resources

- PR: #120
