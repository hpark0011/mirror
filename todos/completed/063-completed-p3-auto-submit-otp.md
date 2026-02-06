---
status: completed
priority: p3
issue_id: "063"
tags: [auth, otp, ux]
dependencies: ["061"]
---

# Auto-Submit OTP on Completion

## Problem Statement

The plan specified auto-verify when all 6 digits are entered, with a manual "Verify" button as fallback. This was not implemented.

## Affected Files

- `packages/features/auth/views/otp-view.tsx` (or hook layer)

## Expected Behavior

When the user enters the 6th digit, automatically call `onVerifyOTP()`. The `InputOTP` component's `onComplete` callback makes this straightforward.

## Acceptance Criteria

- [ ] OTP auto-submits when all 6 digits entered
- [ ] Manual "Verify" button still available as fallback
- [ ] No double-submission (statusRef guard handles this)

## Notes

Depends on #061 (InputOTP component adoption) since `InputOTP` provides an `onComplete` callback.

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-06 | Created from plan audit | Plan key design decision #3 |
