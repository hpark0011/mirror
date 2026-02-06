---
status: completed
priority: p2
issue_id: "074"
tags: [auth, otp, performance, code-review]
dependencies: []
---

# Fix resendCooldown Timer and Callback Performance

## Problem Statement

Two related performance issues with `resendCooldown`:

1. **Timer churn:** `resendCooldown` is in the `useEffect` dependency array (line 68). Every second the state updates, the effect tears down and recreates the interval — 60 create/destroy cycles per cooldown. Also introduces subtle timing drift.

2. **Memo defeat:** `resendCooldown` is in `resendOTP`'s `useCallback` dependency array (line 153). The callback gets a new identity every second, which propagates through forms → views and causes `React.memo` on `OTPView` to re-render 60 times during each cooldown period.

## Affected Files

- `packages/features/auth/hooks/use-otp-auth.ts` (lines 56-68, 130-153)

## Acceptance Criteria

- [x] Only one interval is created per cooldown period (not 60)
- [x] `resendOTP` callback identity is stable during countdown
- [x] `OTPView` memo prevents re-renders during countdown (verify with React DevTools)
- [x] Timer still counts down correctly and re-enables the resend button

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-06 | Created from PR #104 multi-agent review (performance, races) | resendCooldown in deps defeats both interval stability and React.memo |
| 2026-02-06 | Completed: added `resendCooldownRef`, changed effect dep to `[resendCooldown > 0]` (boolean), switched `resendOTP` guard to use ref, removed `resendCooldown` from callback deps. | Boolean dep trick for useEffect: `[value > 0]` only re-fires on 0↔non-zero transitions. eslint-disable needed for non-standard dep expression. |
