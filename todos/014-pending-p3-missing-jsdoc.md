---
status: pending
priority: p3
issue_id: "014"
tags: [code-review, documentation]
dependencies: []
---

# Missing JSDoc on Factory Functions

## Problem Statement

Factory functions in the auth package lack JSDoc documentation, violating the codebase standards in CLAUDE.md which requires JSDoc with purpose, params, returns, and example.

## Findings

**Functions Missing JSDoc:**
- `createAppAuthClient` in `packages/features/auth/client.ts`
- `createAuthServerUtils` in `packages/features/auth/server.ts`
- `createUseSession` in `packages/features/auth/hooks/use-session.ts`

**From CLAUDE.md:**
> All custom hooks MUST have JSDoc with purpose, params, returns, example

## Proposed Solutions

### Option A: Add JSDoc (Recommended)

**Pros:** Follows codebase standards, better DX
**Cons:** Minor effort
**Effort:** Small
**Risk:** Low

```typescript
/**
 * Creates an application-specific auth client with Better Auth integration.
 * @param baseURL - The base URL for auth API endpoints
 * @returns Configured auth client with Convex and magic link plugins
 * @example
 * const authClient = createAppAuthClient(process.env.NEXT_PUBLIC_SITE_URL!);
 */
export function createAppAuthClient(baseURL: string) { ... }
```

## Recommended Action

Add JSDoc to all factory functions.

## Technical Details

**Affected Files:**
- `packages/features/auth/client.ts`
- `packages/features/auth/server.ts`
- `packages/features/auth/hooks/use-session.ts`

## Acceptance Criteria

- [ ] Add JSDoc to createAppAuthClient
- [ ] Add JSDoc to createAuthServerUtils
- [ ] Add JSDoc to createUseSession
- [ ] Include @param, @returns, and @example

## Work Log

| Date | Action | Outcome |
|------|--------|---------|
| 2026-01-28 | Created from code review | Identified P3 documentation issue |

## Resources

- CLAUDE.md JSDoc requirements
