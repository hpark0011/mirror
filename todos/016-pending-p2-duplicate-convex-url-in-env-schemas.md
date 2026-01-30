---
status: pending
priority: p2
issue_id: "016"
tags: [code-review, architecture, env-validation]
dependencies: []
---

# Duplicate NEXT_PUBLIC_CONVEX_URL in Server and Client Env Schemas

## Problem Statement

`NEXT_PUBLIC_CONVEX_URL` is defined in both `lib/env/server.ts` and `lib/env/client.ts`. This creates:
1. Redundant validation
2. Confusion about where to import from
3. Potential inconsistency if schemas diverge

Variables prefixed with `NEXT_PUBLIC_` are inherently client-safe in Next.js and should only be in the client schema.

## Findings

**Location:**
- `apps/mirror/lib/env/server.ts` (lines 10-11)
- `apps/mirror/lib/env/client.ts` (lines 11-13)

**Evidence:** Server env file contains:
```typescript
const serverEnvSchema = z.object({
  NEXT_PUBLIC_CONVEX_URL: z.string().url(...),
  NEXT_PUBLIC_CONVEX_SITE_URL: z.string().url(...),
});
```

These are public variables being treated as server secrets.

## Proposed Solutions

### Option A: Remove from server.ts (Recommended)
- **Pros:** Clean separation, follows Next.js conventions
- **Cons:** Need to update any server code using `serverEnv.NEXT_PUBLIC_CONVEX_URL`
- **Effort:** Small
- **Risk:** Low

### Option B: Create shared schema
- **Pros:** Single source of truth
- **Cons:** More complex setup
- **Effort:** Medium
- **Risk:** Low

### Option C: Rename server-only vars
- **Pros:** Clear distinction
- **Cons:** Requires Convex config changes if truly server-only
- **Effort:** Medium
- **Risk:** Medium

## Recommended Action

(To be filled during triage)

## Technical Details

**Affected Files:**
- `apps/mirror/lib/env/server.ts`
- `apps/mirror/lib/env/client.ts`

## Acceptance Criteria

- [ ] No duplicate env variables between server and client schemas
- [ ] Clear documentation on which vars belong where
- [ ] All imports updated to use correct schema

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-29 | Created from code review | Pattern analysis identified the duplication |

## Resources

- PR branch: feel-good/012826-auth_ui
