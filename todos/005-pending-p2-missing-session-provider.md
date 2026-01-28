---
status: pending
priority: p2
issue_id: "005"
tags: [code-review, performance, auth]
dependencies: []
---

# Missing Session Context Provider - Duplicate API Calls

## Problem Statement

Every component that calls `useSession()` makes an independent API request to fetch session data. There is no React Context provider to share session state across the component tree, causing O(n) API calls where n = number of components using the hook.

## Findings

**File:** `packages/features/auth/hooks/use-session.ts`

**Current Implementation:**
```typescript
useEffect(() => {
  authClient.getSession().then(({ data }) => {  // API call on every mount
    if (data) {
      setSession({ user: data.user });
    }
    setIsLoading(false);
  });
}, []);
```

**Impact at Scale:**
| Users | Components/Page | Current Requests | Optimized Requests |
|-------|-----------------|------------------|-------------------|
| 1000  | 5               | 5000             | 1000              |
| 10000 | 5               | 50000            | 10000             |

## Proposed Solutions

### Option A: Create SessionProvider Context (Recommended)

**Pros:** Single fetch, shared state, proper React pattern
**Cons:** Requires provider setup in app layout
**Effort:** Medium
**Risk:** Low

```typescript
// SessionProvider.tsx
const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children, authClient }) {
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    authClient.getSession().then(({ data }) => {
      setSession(data ? { user: data.user } : null);
      setIsLoading(false);
    });
  }, []);

  return (
    <SessionContext.Provider value={{ session, isLoading }}>
      {children}
    </SessionContext.Provider>
  );
}
```

### Option B: Use better-auth's Built-in Hook
Better Auth may provide `useSession` with caching.

**Pros:** Less code, maintained by library
**Cons:** Depends on library support
**Effort:** Small
**Risk:** Low

## Recommended Action

Implement Option A - create SessionProvider and wrap the app.

## Technical Details

**Affected Files:**
- `packages/features/auth/hooks/use-session.ts`
- `apps/mirror/app/layout.tsx`

## Acceptance Criteria

- [ ] Create SessionProvider context
- [ ] Wrap app in provider
- [ ] Update useSession to use context
- [ ] Verify single API call per page load
- [ ] Add session refresh on window focus (optional)

## Work Log

| Date | Action | Outcome |
|------|--------|---------|
| 2026-01-28 | Created from code review | Identified P2 performance issue |

## Resources

- React Context: https://react.dev/reference/react/useContext
