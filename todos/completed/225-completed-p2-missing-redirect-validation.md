---
status: completed
priority: p2
issue_id: "225"
tags: [code-review, security, auth]
dependencies: []
---

# Missing Redirect URL Validation in Auth Forms

## Problem Statement

The `ForgotPasswordForm` and `ResetPasswordForm` components pass `redirectTo`/`redirectURL` props directly to Better Auth API calls without validation. This creates potential open redirect vulnerabilities if an attacker can control the redirect URL parameter.

The `SignInForm` component correctly uses `getSafeRedirectUrl()` for validation, but this pattern is not applied consistently across all auth forms.

## Findings

**Affected Files:**
- `packages/features/auth/components/forgot-password-form.tsx` (line 29)
- `packages/features/auth/components/reset-password-form.tsx` (line 55)

**Inconsistent with:**
- `packages/features/auth/components/sign-in-form.tsx` (line 25) - correctly uses `getSafeRedirectUrl()`

**ForgotPasswordForm (vulnerable):**
```typescript
await authClient.forgetPassword(
  { email, redirectTo: redirectURL },  // No validation
  { onSuccess, onError }
);
```

**SignInForm (correct pattern):**
```typescript
import { getSafeRedirectUrl } from "../utils/validate-redirect";
const nextUrl = getSafeRedirectUrl(redirectTo ?? searchParams.get("next"));
```

**Mitigating Factors:**
- Default values are relative paths (`/reset-password`, `/sign-in`)
- Server-side rate limiting exists (3 requests/60 seconds)
- Better Auth may perform server-side redirect validation
- Exploitation requires attacker to control the prop value

## Proposed Solutions

### Option A: Apply getSafeRedirectUrl to All Forms (Recommended)

Add `getSafeRedirectUrl()` validation to `ForgotPasswordForm` and `ResetPasswordForm`.

**Pros:** Consistent security posture, follows existing pattern
**Cons:** Minor code change
**Effort:** Small
**Risk:** Low

```typescript
// forgot-password-form.tsx
import { getSafeRedirectUrl } from "../utils/validate-redirect";

export function ForgotPasswordForm({
  authClient,
  redirectURL = "/reset-password",
}: ForgotPasswordFormProps) {
  const safeRedirectURL = getSafeRedirectUrl(redirectURL, "/reset-password");

  // Use safeRedirectURL instead of redirectURL
  await authClient.forgetPassword(
    { email, redirectTo: safeRedirectURL },
    { onSuccess, onError }
  );
}
```

### Option B: Validate at Component Boundary

Create a wrapper or HOC that validates all redirect props before passing to auth forms.

**Pros:** Centralized validation
**Cons:** More complex, may be over-engineering
**Effort:** Medium
**Risk:** Low

## Recommended Action

Option A - Apply the same `getSafeRedirectUrl()` pattern used in `SignInForm` to both `ForgotPasswordForm` and `ResetPasswordForm` for consistency.

## Technical Details

**Affected Files:**
- `packages/features/auth/components/forgot-password-form.tsx`
- `packages/features/auth/components/reset-password-form.tsx`

**Validation Utility:**
- `packages/features/auth/utils/validate-redirect.ts` (already exists)

## Acceptance Criteria

- [x] `ForgotPasswordForm` uses `getSafeRedirectUrl()` for redirect validation
- [x] `ResetPasswordForm` uses `getSafeRedirectUrl()` for redirect validation
- [x] All auth forms have consistent redirect URL handling
- [x] TypeScript compiles without errors
- [ ] Password reset flow still works correctly (manual testing)

## Work Log

| Date | Action | Outcome |
|------|--------|---------|
| 2026-01-28 | Created from PR #68 code review | Identified P2 security consistency issue |
| 2026-01-28 | Applied Option A fix | Added `getSafeRedirectUrl()` to both forms, build passes |

## Resources

- PR #68: https://github.com/hpark0011/feel-good/pull/68
- Validation utility: `packages/features/auth/utils/validate-redirect.ts`
- OWASP Open Redirect: https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/11-Client-side_Testing/04-Testing_for_Client-side_URL_Redirect
