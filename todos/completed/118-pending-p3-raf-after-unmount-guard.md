---
status: pending
priority: p3
issue_id: "118"
tags: [code-review, race-condition, mirror, profile]
dependencies: []
---

# RAF Callback Can Fire After Unmount Cleanup

## Problem Statement

If the component unmounts between a RAF being scheduled (in `handlePointerMove`) and the RAF firing, the cleanup effect cancels `rafRef.current`. However, if a second `pointermove` dispatches in the same microtask batch before React cleanup runs, a new RAF is scheduled after cleanup already ran. The RAF callback would then write to unmounted DOM nodes.

## Findings

- **Source:** julik-frontend-races-reviewer agent
- **Location:** `apps/mirror/features/profile/hooks/use-bottom-sheet.ts` `handlePointerMove` RAF scheduling (lines 186-188)

## Proposed Solutions

### Option A: Add alive ref guard (Recommended)
```typescript
const aliveRef = useRef(true);
useEffect(() => () => { aliveRef.current = false; }, []);

// In RAF callback:
rafRef.current = requestAnimationFrame(() => {
  if (!aliveRef.current) return;
  applyTransform(newProgress, false);
});
```
- **Effort:** Trivial
- **Risk:** None

## Acceptance Criteria

- [x] RAF callback checks alive/mounted guard before DOM writes
- [x] No console errors on navigation during mid-drag

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-09 | Created from PR #106 review | Guard RAF callbacks against unmount races |
| 2026-02-09 | Implemented Option A fix | Added `aliveRef` guard in cleanup effect and RAF callback |

## Resources

- PR: https://github.com/hpark0011/feel-good/pull/106
