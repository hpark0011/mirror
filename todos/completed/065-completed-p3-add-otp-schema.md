---
status: completed
priority: p3
issue_id: "065"
tags: [auth, validation, schemas]
dependencies: []
---

# Add OTPSchema to Auth Schemas

## Problem Statement

The plan called for an `OTPSchema` in `auth.schema.ts` for form validation. It was not added.

## Affected Files

- `packages/features/auth/lib/schemas/auth.schema.ts`

## Expected Addition

```typescript
export const OTPSchema = z.object({
  email: emailSchema,
  otp: z.string().length(6, "Enter all 6 digits"),
});

export type OTPData = z.infer<typeof OTPSchema>;
```

## Notes

Currently the OTP form doesn't use schema-based validation (hook manages state directly). Adding the schema would align with the magic link pattern and enable react-hook-form integration if desired later.

## Acceptance Criteria

- [ ] `OTPSchema` exported from `auth.schema.ts`
- [ ] Re-exported from `schemas/index.ts`

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-06 | Created from plan audit | Plan Phase 2.3 |
