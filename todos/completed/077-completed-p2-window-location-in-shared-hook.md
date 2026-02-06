---
status: completed
priority: p2
issue_id: "077"
tags: [auth, otp, architecture, code-review]
dependencies: []
---

# Remove window.location.href from Shared Hook

## Problem Statement

`useOTPAuth.verifyOTP` performs `window.location.href = callbackURL` directly (line 113). This diverges from `useMagicLinkRequest` which delegates redirect to the auth client. A shared package hook should not own navigation behavior — it prevents consumers from doing soft navigation, showing success messages, or any post-auth logic before redirect.

Additionally, if `verifyOTP` succeeds after the component unmounts (user navigated away), the `window.location.href` fires and yanks the user to an unexpected page.

## Affected Files

- `packages/features/auth/hooks/use-otp-auth.ts` (lines 110-115)
- `packages/features/auth/components/forms/otp-login-form.tsx`
- `packages/features/auth/components/forms/otp-sign-up-form.tsx`

## Acceptance Criteria

- [x] `useOTPAuth` does not call `window.location.href`
- [x] Consuming app (Mirror) handles redirect in its `onSuccess` callback
- [x] Post-unmount verify no longer causes unexpected navigation

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-06 | Created from PR #104 multi-agent review (architecture, patterns, races) | Shared hooks should not own browser navigation |
| 2026-02-06 | Completed: removed `window.location.href`, `getSafeRedirectUrl` import, and `redirectTo` from hook options. Moved redirect logic to form components (`OTPLoginForm`, `OTPSignUpForm`) via `handleSuccess` wrapper that calls `onSuccess` then redirects. | Redirect responsibility belongs in the form/block layer, not the headless hook. The form has access to `redirectTo` and can wrap `onSuccess` cleanly. |
