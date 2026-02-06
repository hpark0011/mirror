---
status: completed
priority: p2
issue_id: "076"
tags: [auth, security, convex, code-review]
dependencies: ["069"]
---

# Narrow sendOTP type Validator

## Problem Statement

The `sendOTP` Convex action accepts `type: v.string()` — any arbitrary string. Even after converting to `internalAction` (#069), defense-in-depth requires restricting the type to known Better Auth OTP types.

## Affected Files

- `packages/convex/convex/email.ts` (line 123)

## Proposed Solution

```typescript
type: v.union(
  v.literal("sign-in"),
  v.literal("sign-up"),
  v.literal("email-verification"),
  v.literal("forget-password")
),
```

**Effort:** Small | **Risk:** Low

## Acceptance Criteria

- [x] `type` parameter uses a union of literal validators
- [x] OTP emails still send correctly for sign-in and sign-up flows

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-06 | Created from PR #104 multi-agent review (security, typescript) | Convex validators should be as narrow as possible per guidelines |
| 2026-02-06 | Completed: narrowed type to union of literals | Defense-in-depth for internalAction |
