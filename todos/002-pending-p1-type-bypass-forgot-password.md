---
status: pending
priority: p1
issue_id: "002"
tags: [code-review, typescript, auth]
dependencies: []
---

# Type Safety Bypass in ForgotPasswordForm

## Problem Statement

The `ForgotPasswordForm` component casts `authClient` to `any` to call `forgetPassword`, completely bypassing TypeScript's type safety. This indicates either the `AuthClient` type definition is incomplete or the method does not exist.

## Findings

**File:** `packages/features/auth/components/forgot-password-form.tsx` (lines 29-34)

**Problematic Code:**
```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const client = authClient as any;
const { error: resetError } = await client.forgetPassword({
  email,
  redirectTo: redirectURL,
});
```

**Issues Identified:**
1. Uses `any` type cast, completely bypassing TypeScript safety
2. Uses different API pattern (destructuring `{ error }`) than all other forms (callback-based)
3. Method name `forgetPassword` may not match Better Auth API (could be `requestPasswordReset`)
4. If the API changes, this will fail silently at runtime

## Proposed Solutions

### Option A: Fix AuthClient Type Definition (Recommended)
Extend the `AuthClient` type to include the password reset method properly.

**Pros:** Type-safe, consistent with codebase patterns
**Cons:** Requires understanding Better Auth's actual type exports
**Effort:** Medium
**Risk:** Low

### Option B: Use Callback Pattern Like Other Forms
Refactor to use the same callback-based API as other auth forms.

**Pros:** Consistent with other forms, type-safe
**Cons:** May require API discovery
**Effort:** Small
**Risk:** Low

```typescript
await authClient.forgetPassword(
  { email, redirectTo: redirectURL },
  {
    onSuccess: () => setStatus("success"),
    onError: (ctx) => {
      setStatus("error");
      setError(getAuthErrorMessage(ctx.error.code));
    },
  }
);
```

## Recommended Action

1. Check Better Auth documentation for correct method name and signature
2. Either extend `AuthClient` type or use callback pattern
3. Remove the `any` cast and eslint-disable comment

## Technical Details

**Affected File:** `packages/features/auth/components/forgot-password-form.tsx`

## Acceptance Criteria

- [ ] Remove `any` type cast
- [ ] Remove eslint-disable comment
- [ ] Use proper Better Auth API method
- [ ] Match error handling pattern of other forms
- [ ] TypeScript compiles without errors

## Work Log

| Date | Action | Outcome |
|------|--------|---------|
| 2026-01-28 | Created from code review | Identified P1 type safety issue |

## Resources

- Better Auth Docs: https://www.better-auth.com/docs
- File: `packages/features/auth/components/forgot-password-form.tsx`
