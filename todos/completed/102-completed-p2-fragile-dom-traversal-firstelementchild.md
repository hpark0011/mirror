---
status: completed
priority: p2
issue_id: "102"
tags: [code-review, maintainability, mirror]
dependencies: []
---

# Fragile DOM Traversal via firstElementChild in useBottomSheet

## Problem Statement

`useBottomSheet` accesses the background element via `sheet.parentElement.firstElementChild as HTMLElement` three times. This creates an invisible structural contract: the consumer MUST render the background as the first child of the sheet's parent. If the JSX structure changes (e.g., adding a wrapper div), the parallax effect silently breaks.

## Findings

- **Source:** pattern-recognition-specialist, kieran-typescript-reviewer, architecture-strategist agents
- **Location:** `apps/mirror/app/(protected)/dashboard/_hooks/use-bottom-sheet.ts` lines 69, 95, 133
- **Evidence:** `container.firstElementChild as HTMLElement | null` appears 3 times with unsafe cast.

## Proposed Solutions

### Option A: Explicit bgRef (Recommended)
- Add `bgRef` to hook return value, let consumer attach it to background element
- Removes all 3 `firstElementChild` traversals and `as HTMLElement` casts
- **Effort:** Small
- **Risk:** Low

## Acceptance Criteria

- [ ] No `firstElementChild` traversal in hook
- [ ] Background element targeted via explicit ref
- [ ] No `as HTMLElement` casts for DOM traversal

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-09 | Created from PR #105 round 2 review | Use explicit refs instead of positional DOM traversal |

## Resources

- PR: https://github.com/hpark0011/feel-good/pull/105
