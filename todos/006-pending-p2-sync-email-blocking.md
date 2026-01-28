---
status: pending
priority: p2
issue_id: "006"
tags: [code-review, performance, auth]
dependencies: []
---

# Email Sending Blocks Auth Flow (Synchronous await)

## Problem Statement

Email operations use `await ctx.runAction()`, which blocks the authentication response until the email is sent. Email delivery can take 500ms-3000ms depending on the provider, making auth feel slow.

## Findings

**File:** `packages/convex/convex/auth.ts`

**Blocking Calls:**
```typescript
sendResetPassword: async ({ user, url }) => {
  await ctx.runAction(api.email.sendPasswordReset, { ... });  // Blocking
},

sendVerificationEmail: async ({ user, url }) => {
  await ctx.runAction(api.email.sendVerificationEmail, { ... });  // Blocking
},
```

**Impact:**
- Sign-up response time: 200ms (auth) + 800ms (email) = 1000ms+ total
- Password reset response time: similarly delayed
- Users perceive the auth system as slow

## Proposed Solutions

### Option A: Fire-and-Forget Pattern (Recommended)

**Pros:** Immediate response, simple change
**Cons:** No error handling for email failures
**Effort:** Small
**Risk:** Low

```typescript
sendResetPassword: async ({ user, url }) => {
  // Don't await - fire and forget
  ctx.runAction(api.email.sendPasswordReset, { to: user.email, link: url });
},
```

### Option B: Convex Scheduler
Use Convex's scheduling to queue emails asynchronously.

**Pros:** Reliable delivery, retry capability
**Cons:** More complex setup
**Effort:** Medium
**Risk:** Low

## Recommended Action

Implement Option A for immediate improvement, consider Option B for production reliability.

## Technical Details

**Affected File:** `packages/convex/convex/auth.ts`

## Acceptance Criteria

- [ ] Remove await from email sending operations
- [ ] Test that auth responses are faster
- [ ] Verify emails still send correctly
- [ ] Consider adding email queue for reliability (optional)

## Work Log

| Date | Action | Outcome |
|------|--------|---------|
| 2026-01-28 | Created from code review | Identified P2 performance issue |

## Resources

- Convex Scheduling: https://docs.convex.dev/scheduling/scheduled-functions
