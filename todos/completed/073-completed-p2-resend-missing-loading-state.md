---
status: completed
priority: p2
issue_id: "073"
tags: [auth, otp, race-condition, code-review]
dependencies: ["068"]
---

# Add Loading State to resendOTP

## Problem Statement

`resendOTP` never calls `setStatus("loading")`, unlike `requestOTP` and `verifyOTP`. This means:
1. The `statusRef` guard does not protect against concurrent operations during resend
2. The user can type and submit a stale OTP code while a resend is in flight, causing a race where the old code is verified against a newly rotated OTP
3. The UI (InputOTP, buttons) is not disabled during resend because `isLoading` stays false

## Affected Files

- `packages/features/auth/hooks/use-otp-auth.ts` (lines 130-153)

## Acceptance Criteria

- [x] `resendOTP` sets status to "loading" before the API call
- [x] InputOTP and buttons are disabled during resend
- [x] User cannot submit a stale code while resend is in flight

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-06 | Created from PR #104 multi-agent review (races reviewer) | Missing loading state allows stale-OTP race condition |
| 2026-02-06 | Completed: already fixed in commit 82c5411d (P1 todo batch). Both `statusRef.current = "loading"` and `setStatus("loading")` were added to resendOTP. | This was resolved as part of the P1 statusRef sync guard work (#068). |
