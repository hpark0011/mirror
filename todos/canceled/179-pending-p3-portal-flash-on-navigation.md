---
status: pending
priority: p3
issue_id: "179"
tags: [code-review, performance, portal, mirror]
dependencies: []
---

# Portal Target May Flash on Soft Navigation

## Problem Statement

`WorkspaceToolbar` uses `useState` for the portal target. On soft navigation (Next.js client-side route change), `ToolbarSlotTarget` unmounts (cleanup sets `null`) and remounts (layout effect sets new element). Between these, `WorkspaceToolbar` returns `null` for one React commit cycle. Since `useLayoutEffect` fires before paint, this is likely invisible — but could theoretically cause a toolbar flash on fast navigation.

## Findings

- **Location:** `apps/mirror/components/workspace-toolbar-slot.tsx:24-44`
- **Mechanism:** `useState` setter from `useLayoutEffect` → async state update → one null render
- **Source:** PR #121 — frontend races reviewer flagged as High, but `useLayoutEffect` timing makes it likely theoretical
- **Mitigation already in place:** `useLayoutEffect` (not `useEffect`) ensures the update fires synchronously before browser paint

## Proposed Solutions

### Option A: Monitor and fix if observed
Keep current implementation. Only invest in `useSyncExternalStore` if users report toolbar flashing.

- **Effort:** None
- **Risk:** Low — unlikely to manifest

### Option B: useSyncExternalStore (if needed)
Replace `useState` with a store pattern that allows synchronous reads:

```tsx
function createToolbarSlotStore() {
  let target: HTMLElement | null = null;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => target,
    subscribe: (cb: () => void) => { listeners.add(cb); return () => listeners.delete(cb); },
    setTarget: (el: HTMLElement | null) => { target = el; listeners.forEach(cb => cb()); },
  };
}
```

- **Effort:** Medium
- **Risk:** Over-engineering if the problem doesn't manifest

## Acceptance Criteria

- [ ] Verify no toolbar flash on navigation between `/@username` and `/@username/slug`
- [ ] If flash observed, implement Option B

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-13 | Created from PR #121 review | useLayoutEffect likely prevents the flash; monitor first |
