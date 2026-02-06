---
status: completed
priority: p1
issue_id: "071"
tags: [auth, otp, bug, code-review]
dependencies: []
---

# Fix Hardcoded type: "sign-in" in OTP Sign-Up Flow

## Problem Statement

`useOTPAuth` hardcodes `type: "sign-in"` in both `requestOTP` and `resendOTP`. This means the sign-up flow sends the wrong type to Better Auth, resulting in incorrect email copy.

## Correction from Implementation

The original todo assumed `"sign-up"` was a valid Better Auth OTP type. The actual API accepts `"sign-in" | "email-verification" | "forget-password"`. The sign-up form now passes `"email-verification"`.

## Affected Files

- `packages/features/auth/hooks/use-otp-auth.ts`
- `packages/features/auth/components/forms/otp-sign-up-form.tsx`

## Acceptance Criteria

- [x] `useOTPAuth` accepts a `type` option defaulting to `"sign-in"`
- [x] `OTPSignUpForm` passes `type: "email-verification"` to the hook
- [x] Sign-up OTP emails say "complete your sign up"
- [x] Sign-in OTP emails say "sign in to your account"

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-06 | Created from PR #104 multi-agent review (architecture, typescript, patterns) | All 3 reviewers independently flagged this as a user-facing bug |
| 2026-02-06 | Added `type` option to `UseOTPAuthOptions`, wired `"email-verification"` in sign-up form | Better Auth OTP types are `"sign-in" | "email-verification" | "forget-password"` — not `"sign-up"` |
