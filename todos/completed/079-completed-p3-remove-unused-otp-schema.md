---
status: completed
priority: p3
issue_id: "079"
tags: [auth, otp, dead-code, cleanup, code-review]
dependencies: []
---

# Remove Unused otpSchema, OTPSchema, OTPData

## Problem Statement

`otpSchema`, `OTPSchema`, and `OTPData` are defined in `auth.schema.ts` and re-exported from `schemas/index.ts` but never imported or used anywhere. `useOTPAuth` does not validate with Zod. Additionally, `OTPSchema` and `OTPData` are identical type aliases.

## Affected Files

- `packages/features/auth/lib/schemas/auth.schema.ts` (lines 19-25)
- `packages/features/auth/lib/schemas/index.ts` (lines 6-8)

## Proposed Solution

Delete the unused schema and types. If client-side validation is needed later, it can be re-added (YAGNI).

Also remove the unused `reset` function from `useOTPAuth` (lines 36, 163-170, 185) and unused `disabled` prop from OTP form interfaces.

**Effort:** Small | **Risk:** None

## Acceptance Criteria

- [ ] `otpSchema`, `OTPSchema`, `OTPData` removed from schema files
- [ ] Barrel re-exports updated
- [ ] No TypeScript compilation errors

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-06 | Created from PR #104 multi-agent review (typescript, simplicity, patterns) | All 3 agents flagged as dead code |
| 2026-02-06 | Completed: removed otpSchema, OTPSchema, OTPData | Verified no imports anywhere in codebase |
