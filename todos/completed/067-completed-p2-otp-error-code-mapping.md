---
status: completed
priority: p2
issue_id: "067"
tags: [auth, otp, error-handling, code-review]
dependencies: []
---

# Align OTP Error Mapping with Better Auth Error Codes

## Problem Statement

`getAuthErrorMessage` maps OTP errors using keys that do not match Better Auth email-OTP error codes. Better Auth emits `INVALID_OTP` and `TOO_MANY_ATTEMPTS`, while the current map uses `OTP_INVALID` and `OTP_MAX_ATTEMPTS`. This causes OTP failures to fall back to `UNKNOWN`, showing generic messages instead of actionable OTP-specific feedback.

## Affected Files

- `packages/features/auth/types.ts`

## Current Behavior

```typescript
OTP_INVALID: "Invalid code. Please check and try again.",
OTP_MAX_ATTEMPTS: "Too many attempts. Please request a new code.",
```

When Better Auth returns:
- `INVALID_OTP`
- `TOO_MANY_ATTEMPTS`

the lookup misses and returns `UNKNOWN`.

## Expected Behavior

Error mapping should handle upstream Better Auth codes so OTP flows display correct user-facing messages:

- `INVALID_OTP` -> invalid code message
- `TOO_MANY_ATTEMPTS` -> too many attempts message
- keep `OTP_EXPIRED` handling intact

## Acceptance Criteria

- [ ] `AUTH_ERROR_MESSAGES` includes mappings for `INVALID_OTP` and `TOO_MANY_ATTEMPTS`
- [ ] OTP verify failures no longer fall back to `UNKNOWN` for these cases
- [ ] Existing OTP error mappings remain backward compatible if legacy keys are still referenced

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-06 | Created from PR #104 code review finding | Better Auth code constants must be mapped verbatim to avoid silent fallback to `UNKNOWN` |
| 2026-02-06 | Completed: added INVALID_OTP and TOO_MANY_ATTEMPTS mappings | Keep old keys for backward compat |
