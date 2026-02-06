---
status: completed
priority: p3
issue_id: "064"
tags: [auth, types]
dependencies: []
---

# Add "email-otp" to AuthProvider Type

## Problem Statement

The `AuthProvider` union type in `types.ts` is still `"google" | "magic-link"`. The plan called for adding `"email-otp"`.

## Affected Files

- `packages/features/auth/types.ts` line 16

## Fix

```typescript
export type AuthProvider = "google" | "magic-link" | "email-otp";
```

## Acceptance Criteria

- [ ] `AuthProvider` type includes `"email-otp"`
- [ ] No TypeScript errors in consuming code

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-06 | Created from plan audit | Plan Phase 2.2 |
