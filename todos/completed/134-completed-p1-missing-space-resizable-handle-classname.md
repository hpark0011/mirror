---
status: completed
priority: p1
issue_id: "134"
tags: [code-review, bug, tailwind, mirror]
dependencies: []
---

# Missing Space in ResizableHandle className Breaks z-index and Drag Shadow

## Problem Statement

In `profile-shell.tsx` line 79, `z-200 relative` is concatenated directly after the closing `]` of a Tailwind data-attribute selector without a space separator. Tailwind parses `...hover)]z-200` as one invalid token, so the drag shadow variant, `z-200`, and `relative` are all broken. The resize handle may render behind content panels and lose its drag shadow.

This was introduced during the JSX reformatting when wrapping with `<ProfileProvider>`.

## Findings

- **Source:** security-sentinel, architecture-strategist, pattern-recognition-specialist, kieran-typescript-reviewer, code-simplicity-reviewer, performance-oracle (6/6 agents)
- **Location:** `apps/mirror/app/[username]/_components/profile-shell.tsx` line 79
- **Evidence:** Diff shows original on main had no `z-200 relative`; this PR appended them without a space

## Proposed Solutions

### Option A: Add missing space (Recommended)

- Change `...hover)]z-200 relative"` to `...hover)] z-200 relative"`
- **Effort:** Small
- **Risk:** None

## Acceptance Criteria

- [ ] `z-200` and `relative` are separate valid Tailwind classes
- [ ] Resize handle renders above content panels (z-index works)
- [ ] Drag shadow appears on handle interaction
- [ ] `pnpm build --filter=@feel-good/mirror` passes

## Work Log

| Date       | Action                      | Learnings                                                           |
| ---------- | --------------------------- | ------------------------------------------------------------------- |
| 2026-02-11 | Created from PR #115 review | Watch for missing spaces when reformatting long Tailwind classNames |

## Resources

- PR: https://github.com/hpark0011/feel-good/pull/115
