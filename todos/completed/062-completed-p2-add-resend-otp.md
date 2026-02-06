---
status: completed
priority: p2
issue_id: "062"
tags: [auth, otp, ux]
dependencies: []
---

# Add Resend OTP Functionality

## Problem Statement

The plan specified a `resendOTP` action in the hook and a "Resend code" link in the OTP verification view. Neither was implemented. Users who don't receive their code or whose code expires have no way to request a new one without going back and re-entering their email.

## Affected Files

- `packages/features/auth/hooks/use-otp-auth.ts` — add `resendOTP` action
- `packages/features/auth/views/otp-view.tsx` — add "Resend code" link in verify phase

## Expected Hook Addition

```typescript
const resendOTP = useCallback(async () => {
  if (statusRef.current === "loading") return;
  setError(null);
  setOtp("");
  // Re-sends OTP to the same email
  await authClient.emailOtp.sendVerificationOtp(
    { email, type: "sign-in" },
    { onSuccess: () => { /* toast or subtle feedback */ }, onError: ... }
  );
}, [email, authClient, onError]);
```

## Expected View Addition

A "Resend code" button/link in the OTP verification step, below or near the verify button.

## Acceptance Criteria

- [ ] `resendOTP` function added to `useOTPAuth` hook
- [ ] "Resend code" link visible in OTP verify phase
- [ ] Old OTP cleared on resend
- [ ] Rate limiting respected (3 sends per 60s already configured server-side)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-06 | Created from plan audit | Plan Phase 3 listed resendOTP; Phase 4 listed "Resend code" link |
