---
status: completed
priority: p1
issue_id: "095"
tags: [code-review, performance, ux, mirror]
dependencies: []
---

# Missing requestAnimationFrame in Pointer Move Handler Causes Layout Thrashing

## Problem Statement

`handlePointerMove` calls `applyTransform` synchronously on every pointer event. `applyTransform` reads from `sheetRef.current.parentElement` (DOM traversal) then writes to `.style.transform` and `.style.transition` on two elements. On 120Hz displays, pointer events fire at up to 120fps causing redundant style writes and potential layout thrashing between read and write operations.

## Findings

- **Source:** performance-oracle agent
- **Location:** `apps/mirror/app/(protected)/dashboard/_hooks/use-bottom-sheet.ts` lines 143-167 (handlePointerMove), 52-79 (applyTransform)
- **Evidence:** Lines 164-165 call `applyTransform(newProgress, false)` synchronously per pointer event. Lines 67-69 traverse `sheet.parentElement.firstElementChild` (read) then write to `.style.transform`.

## Proposed Solutions

### Option A: RAF guard (Recommended)
```typescript
const rafRef = useRef<number>(0);

// In handlePointerMove:
cancelAnimationFrame(rafRef.current);
rafRef.current = requestAnimationFrame(() => {
  applyTransform(newProgress, false);
});

// Cancel in pointerup/cleanup
```
- **Effort:** Small
- **Risk:** Low

## Acceptance Criteria

- [ ] Only one `applyTransform` call per animation frame during drag
- [ ] RAF cancelled on pointerup and cleanup
- [ ] Smooth 60fps drag on throttled CPU

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-09 | Created from PR #105 round 2 review | Batch pointer event DOM writes with RAF |

## Resources

- PR: https://github.com/hpark0011/feel-good/pull/105
