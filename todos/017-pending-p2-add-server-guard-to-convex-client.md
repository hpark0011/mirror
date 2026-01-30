---
status: pending
priority: p2
issue_id: "017"
tags: [code-review, performance, ssr-safety]
dependencies: []
---

# Add Server-Side Guard to getConvexClient()

## Problem Statement

The `getConvexClient()` function in `lib/convex.ts` lacks a server-side guard. If accidentally imported in a server component, it could:
1. Create an orphan Convex client on the server
2. Cause confusing errors during SSR
3. Waste resources establishing WebSocket connections that are never used

## Findings

**Location:** `apps/mirror/lib/convex.ts`

**Current code:**
```typescript
export function getConvexClient(): ConvexReactClient {
  if (convexClient) {
    return convexClient;
  }
  convexClient = new ConvexReactClient(clientEnv.NEXT_PUBLIC_CONVEX_URL);
  return convexClient;
}
```

**Missing:** `typeof window === "undefined"` check

## Proposed Solutions

### Option A: Add runtime guard (Recommended)
```typescript
export function getConvexClient(): ConvexReactClient {
  if (typeof window === "undefined") {
    throw new Error("getConvexClient must only be called on the client");
  }
  if (convexClient) return convexClient;
  convexClient = new ConvexReactClient(clientEnv.NEXT_PUBLIC_CONVEX_URL);
  return convexClient;
}
```
- **Pros:** Fail-fast, clear error message
- **Cons:** Minor overhead (negligible)
- **Effort:** Small
- **Risk:** Low

### Option B: Add JSDoc warning only
```typescript
/**
 * @client-only This function must only be called in client components.
 */
```
- **Pros:** No runtime overhead
- **Cons:** Doesn't prevent runtime issues
- **Effort:** Trivial
- **Risk:** Low (but less protective)

## Recommended Action

(To be filled during triage)

## Technical Details

**Affected Files:**
- `apps/mirror/lib/convex.ts`

## Acceptance Criteria

- [ ] Function throws helpful error if called server-side
- [ ] Error message explains the issue and solution
- [ ] No impact on client-side performance

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-29 | Created from code review | Performance oracle identified SSR concern |

## Resources

- PR branch: feel-good/012826-auth_ui
