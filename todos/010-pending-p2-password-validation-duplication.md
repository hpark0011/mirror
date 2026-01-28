---
status: pending
priority: p2
issue_id: "010"
tags: [code-review, dry, auth]
dependencies: []
---

# Password Validation Logic Duplicated

## Problem Statement

Password validation logic (minimum 8 characters) is duplicated across `sign-up-form.tsx` and `reset-password-form.tsx`. The magic number `8` appears in both files without a shared constant.

## Findings

**Duplicated Code:**

`sign-up-form.tsx` (lines 26-29):
```typescript
if (password.length < 8) {
  setError(getAuthErrorMessage("PASSWORD_TOO_SHORT"));
  return;
}
```

`reset-password-form.tsx` (lines 33-36):
```typescript
if (password.length < 8) {
  setError(getAuthErrorMessage("PASSWORD_TOO_SHORT"));
  return;
}
```

## Proposed Solutions

### Option A: Extract Validation Utility (Recommended)

**Pros:** Single source of truth, easy to update
**Cons:** Minor abstraction
**Effort:** Small
**Risk:** Low

```typescript
// types.ts or validation.ts
export const PASSWORD_MIN_LENGTH = 8;

export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return "PASSWORD_TOO_SHORT";
  }
  return null;
}
```

## Recommended Action

Extract password validation to a shared utility.

## Technical Details

**Affected Files:**
- `packages/features/auth/components/sign-up-form.tsx`
- `packages/features/auth/components/reset-password-form.tsx`
- `packages/features/auth/types.ts` (add constant)

## Acceptance Criteria

- [ ] Create `PASSWORD_MIN_LENGTH` constant
- [ ] Create `validatePassword` utility function
- [ ] Update both forms to use shared validation
- [ ] Ensure constant matches backend config (minPasswordLength: 8)

## Work Log

| Date | Action | Outcome |
|------|--------|---------|
| 2026-01-28 | Created from code review | Identified P2 DRY violation |

## Resources

- Backend config: `packages/convex/convex/auth.ts` (line 23)
