---
status: completed
priority: p3
issue_id: "080"
tags: [auth, otp, accessibility, cleanup, code-review]
dependencies: []
---

# Fix Unused otpInputId Prop in OTPView

## Problem Statement

`OTPViewProps` declares `otpInputId: string` (line 48), it is destructured (line 69), and passed from `OTPLoginView`/`OTPSignUpView`, but never applied to any DOM element. The `InputOTP` component does not receive an `id` prop. This is an accessibility gap — the OTP input has no programmatic label association.

## Affected Files

- `packages/features/auth/views/otp-view.tsx` (line 69, ~line 158)

## Proposed Solution

Apply `id={otpInputId}` to the `InputOTP` component, or remove the prop if it's not needed.

**Effort:** Small | **Risk:** Low

## Acceptance Criteria

- [x] `otpInputId` is either applied to `InputOTP` or removed from the interface
- [x] If applied, a `FieldLabel` with matching `htmlFor` is added for accessibility

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-06 | Created from PR #104 multi-agent review (typescript reviewer) | Props should either be used or not declared |
| 2026-02-06 | Completed: applied id to InputOTP + added sr-only FieldLabel | Accessibility: label association via htmlFor |
