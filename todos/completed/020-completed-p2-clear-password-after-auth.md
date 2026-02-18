---
status: completed
priority: p2
issue_id: "020"
tags: [code-review, security, auth]
dependencies: []
---

# Clear Password State After Successful Authentication

## Problem Statement

After successful authentication, passwords remain stored in React state until manually cleared or component unmount. This extends the window where sensitive data could be extracted from memory (e.g., via React DevTools or browser session compromise).

## Findings

**Source Agent:** security-sentinel

**Affected Files:**
- `packages/features/auth/hooks/use-password-sign-in.ts`
- `packages/features/auth/hooks/use-password-sign-up.ts`

**Current code:**
```typescript
const [password, setPassword] = useState("");
// ...
onSuccess: () => {
  if (!isMountedRef.current) return;
  setStatus("success");
  options.onSuccess?.();
  // Password NOT cleared here - remains in state
},
```

## Proposed Solutions

### Option A: Clear password on success (Recommended)
```typescript
onSuccess: () => {
  setPassword("");  // Clear immediately
  if (!isMountedRef.current) return;
  setStatus("success");
  options.onSuccess?.();
},
```
- **Pros:** Minimizes exposure window, follows security best practices
- **Cons:** None
- **Effort:** Small (2 lines)
- **Risk:** Low

### Option B: Clear all form state on success
```typescript
onSuccess: () => {
  setEmail("");
  setPassword("");
  if (!isMountedRef.current) return;
  setStatus("success");
  options.onSuccess?.();
},
```
- **Pros:** Complete cleanup
- **Cons:** May affect success UI if email is displayed
- **Effort:** Small
- **Risk:** Low

## Recommended Action

Option A - Clear password immediately. Email can remain for display purposes but password should be wiped.

## Technical Details

**Affected Files:**
- `packages/features/auth/hooks/use-password-sign-in.ts` (onSuccess callback ~line 62)
- `packages/features/auth/hooks/use-password-sign-up.ts` (onSuccess callback ~line 78)

## Acceptance Criteria

- [x] Password state is cleared immediately upon successful authentication
- [x] Password state is cleared even if component is about to unmount
- [x] Success callbacks still fire correctly

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-03 | Created from code review | Security sentinel noted credential exposure window |

## Resources

- Commit: 72235497
- Branch: feel-good/020326-auth_ui_package
