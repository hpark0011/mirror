---
status: pending
priority: p2
issue_id: "011"
tags: [code-review, consistency, auth]
dependencies: []
---

# Hardcoded Error Message Outside Centralized System

## Problem Statement

The reset password form has a hardcoded error message "Passwords do not match" instead of using the centralized `AUTH_ERROR_MESSAGES` constant.

## Findings

**File:** `packages/features/auth/components/reset-password-form.tsx` (line 39)

```typescript
if (password !== confirmPassword) {
  setError("Passwords do not match");  // Hardcoded!
  return;
}
```

**Other errors use centralized messages:**
```typescript
setError(getAuthErrorMessage("PASSWORD_TOO_SHORT"));
setError(getAuthErrorMessage("INVALID_TOKEN"));
```

## Proposed Solutions

### Option A: Add to AUTH_ERROR_MESSAGES (Recommended)

**Pros:** Consistent, centralized, easy i18n
**Cons:** None
**Effort:** Small
**Risk:** Low

```typescript
// types.ts
export const AUTH_ERROR_MESSAGES: Record<string, string> = {
  // ... existing
  PASSWORDS_DONT_MATCH: "Passwords do not match",
};

// reset-password-form.tsx
setError(getAuthErrorMessage("PASSWORDS_DONT_MATCH"));
```

## Recommended Action

Add `PASSWORDS_DONT_MATCH` to `AUTH_ERROR_MESSAGES`.

## Technical Details

**Affected Files:**
- `packages/features/auth/types.ts`
- `packages/features/auth/components/reset-password-form.tsx`

## Acceptance Criteria

- [ ] Add PASSWORDS_DONT_MATCH to AUTH_ERROR_MESSAGES
- [ ] Update reset-password-form to use getAuthErrorMessage
- [ ] Verify error displays correctly

## Work Log

| Date | Action | Outcome |
|------|--------|---------|
| 2026-01-28 | Created from code review | Identified P2 consistency issue |

## Resources

- Types file: `packages/features/auth/types.ts`
