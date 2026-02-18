---
status: completed
priority: p2
issue_id: "034"
tags: [code-review, dock, behavior, ui]
dependencies: []
---

# Hide Dock When Leaving Activation Area

## Problem Statement

The dock can stay visible after the cursor leaves the activation zone because only `onMouseEnter` is wired for the activation area.

## Findings

**Source:** Code review

**Affected Files:**

- `packages/features/dock/blocks/app-dock.tsx`

**Details:**

- Activation zone uses `onMouseEnter` but does not handle `onMouseLeave`.
- Requirement states the dock should slide out when cursor moves away from the activation area.

## Proposed Solutions

### Option A: Add `onMouseLeave` to activation zone (Recommended)

- **Pros:** Matches spec behavior; simple change
- **Cons:** None
- **Effort:** Small
- **Risk:** Low

### Option B: Use pointer enter/leave on a shared wrapper

- **Pros:** Unified hover logic
- **Cons:** More structural change
- **Effort:** Medium
- **Risk:** Low

## Recommended Action

Add `onMouseLeave` on the activation area to call the hide handler.

## Acceptance Criteria

- [ ] Leaving the activation zone schedules dock hide
- [ ] Dock remains visible when cursor moves from activation zone into dock
- [ ] Manual hover test shows dock slides out when cursor leaves activation zone

## Work Log

| Date       | Action                   | Outcome |
| ---------- | ------------------------ | ------- |
| 2026-02-04 | Created from code review | Pending |
