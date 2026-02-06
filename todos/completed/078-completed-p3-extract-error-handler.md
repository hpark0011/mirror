---
status: completed
priority: p3
issue_id: "078"
tags: [auth, otp, cleanup, code-review]
dependencies: []
---

# Extract Shared Error Handler in useOTPAuth

## Problem Statement

The error-handling block is copy-pasted 3 times in `useOTPAuth` (lines 84-91, 117-124, 142-149). When the error shape or handling changes, all three must be updated.

## Affected Files

- `packages/features/auth/hooks/use-otp-auth.ts`

## Proposed Solution

Extract a local `handleAuthError` callback:

```typescript
const handleAuthError = useCallback(
  (ctx: { error: { code?: string } }) => {
    const authError: AuthError = {
      code: ctx.error.code ?? "UNKNOWN",
      message: getAuthErrorMessage(ctx.error.code ?? "UNKNOWN"),
    };
    setStatus("error");
    setError(authError);
    onError?.(authError);
  },
  [onError]
);
```

**Effort:** Small | **Risk:** Low

## Acceptance Criteria

- [x] Error handling logic exists in exactly one place within the hook
- [x] All three callbacks use the shared handler

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-06 | Created from PR #104 multi-agent review (typescript, patterns, simplicity) | 3 identical 7-line blocks is a maintenance trap |
| 2026-02-06 | Completed: extracted `handleAuthError` useCallback, used by all 3 callbacks. Used `Record<string, unknown>` for ctx.error type to match BetterFetchError intersection type. | When typing extracted callbacks for library onError handlers, use wider types (Record) to stay compatible with library's ErrorContext |
