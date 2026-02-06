---
status: completed
priority: p1
issue_id: "068"
tags: [auth, otp, race-condition, code-review]
dependencies: []
---

# Fix statusRef Double-Fire Race in useOTPAuth

## Problem Statement

`verifyOTP` can be invoked twice concurrently because `statusRef.current` is updated via React's render cycle (asynchronous), not synchronously within the callback. When `InputOTP.onComplete` fires and the user simultaneously hits Enter or clicks "Verify", the guard `if (statusRef.current === "loading") return` does not catch the second call because `setStatus("loading")` has not yet committed a re-render.

This results in two concurrent `authClient.signIn.emailOtp` requests. If one succeeds and one fails, the user sees a redirect interrupted by a flash error.

The same gap exists in `requestOTP` and `resendOTP`.

## Affected Files

- `packages/features/auth/hooks/use-otp-auth.ts` (lines 70-71, 97-98, 130-131)

## Proposed Solutions

### Option A: Synchronous statusRef update (Recommended)
Update `statusRef.current` synchronously in each callback before calling `setStatus`:

```typescript
const verifyOTP = useCallback(async () => {
  if (statusRef.current === "loading") return;
  statusRef.current = "loading"; // sync guard
  setStatus("loading");
  // ...
}, [/* deps */]);
```

**Pros:** Minimal change, closes the race window immediately
**Cons:** None significant
**Effort:** Small
**Risk:** Low

### Option B: Dedicated submittingRef boolean
Use a separate `isSubmittingRef` boolean set synchronously.

**Pros:** More explicit intent
**Cons:** Another ref to manage
**Effort:** Small
**Risk:** Low

## Acceptance Criteria

- [x] `statusRef.current` is set to `"loading"` synchronously in `requestOTP`, `verifyOTP`, and `resendOTP` before `setStatus("loading")`
- [x] Pasting 6 digits + pressing Enter does not produce two network requests
- [x] `onComplete` + clicking "Verify" does not produce two network requests

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-06 | Created from PR #104 multi-agent review (races reviewer) | React batched state updates mean statusRef is only updated on render commit, not in the callback microtask |
| 2026-02-06 | Implemented Option A: sync statusRef guard in all 3 callbacks | Also added `setStatus("loading")` to `resendOTP` which was missing it — the guard existed but the state was never set to loading |
