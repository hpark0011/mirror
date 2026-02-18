---
status: completed
priority: p2
issue_id: "227"
tags: [code-review, bug, video-call, mirror]
dependencies: []
---

# Escape Key Handler Captures Stale Closure References

## Problem Statement

The `useEffect` for the Escape key listener in `VideoCallModal` has an empty dependency array but references `handleClose`, which is defined afterward and re-created each render. The effect captures the first render's `handleClose`, which in turn captures a stale `endCall` with a potentially-null `daily` reference. Pressing Escape may fail to properly leave the Daily call.

## Findings

- **Location:** `apps/mirror/features/video-call/components/video-call-modal.tsx:23-32`
- **Source:** PR #133 review (cursor[bot], comment id 2815369844)
- **Severity:** Medium

## Proposed Solutions

Either:
1. Add `handleClose` to the dependency array of the `useEffect`
2. Use a `useCallback` for `handleClose` and include it in deps
3. Use a ref to hold the latest `handleClose` function

Option 3 is cleanest since it avoids re-registering the event listener on every render:

```typescript
const handleCloseRef = useRef(handleClose);
handleCloseRef.current = handleClose;

useEffect(() => {
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") handleCloseRef.current();
  };
  document.addEventListener("keydown", onKeyDown);
  return () => document.removeEventListener("keydown", onKeyDown);
}, []);
```

- **Effort:** Low

## Acceptance Criteria

- [ ] Pressing Escape during an active call properly ends the Daily session and closes the modal
- [ ] No stale closure warnings or unexpected behavior

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-17 | Created from PR #133 code review | Empty deps array with non-stable closure reference |
| 2026-02-17 | Fixed in 7d3743dd | Used handleCloseRef pattern, stabilized handlers with useCallback |
