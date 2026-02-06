---
status: completed
priority: p3
issue_id: "081"
tags: [convex, code-review]
dependencies: ["069"]
---

# Add returns Validator to sendOTP Action

## Problem Statement

The `sendOTP` Convex action (and `sendMagicLink`, `sendVerificationEmail`) are missing `returns` validators. The Convex guidelines require all functions to include `returns` validators.

## Affected Files

- `packages/convex/convex/email.ts` (lines 73, 96, 119)

## Proposed Solution

Add `returns: v.null()` to all three email actions.

**Effort:** Small | **Risk:** None

## Acceptance Criteria

- [x] All email actions have `returns: v.null()`

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-06 | Created from PR #104 multi-agent review (typescript reviewer) | Convex guidelines require returns validators on all functions |
| 2026-02-06 | Completed: added returns: v.null() to all 3 actions | Convex guidelines require returns validators |
