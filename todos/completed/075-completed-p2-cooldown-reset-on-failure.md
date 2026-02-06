---
status: completed
priority: p2
issue_id: "075"
tags: [auth, otp, ux, code-review]
dependencies: []
---

# Reset Cooldown on Resend Failure

## Problem Statement

`resendOTP` sets `setResendCooldown(60)` before the API call (line 134). If the API call fails, the cooldown keeps ticking and the user must wait 60 seconds before retrying, despite the resend never succeeding. This punishes legitimate users for server errors.

## Affected Files

- `packages/features/auth/hooks/use-otp-auth.ts` (lines 130-153)

## Acceptance Criteria

- [x] On resend failure, the resend button is re-enabled (cooldown resets to 0)
- [x] On resend success, 60s cooldown starts as before

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-06 | Created from PR #104 multi-agent review (security, typescript) | Optimistic UI should have rollback on failure |
| 2026-02-06 | Completed: moved `setResendCooldown(60)` from before API call to inside `onSuccess`. Added `setResendCooldown(0)` to error handler. Used custom onError wrapper instead of bare handleAuthError to add cooldown reset. | For resendOTP, the error handler needed to both call the shared handleAuthError AND reset cooldown — inline wrapper is the right pattern here. |
