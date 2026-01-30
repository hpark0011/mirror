---
status: completed
priority: p2
issue_id: "009"
tags: [code-review, architecture, validation]
dependencies: []
---

# Unvalidated Environment Variable Access

## Problem Statement

Environment variables are accessed with non-null assertions (`!`) without validation. If these variables are missing, the application will fail with cryptic runtime errors instead of clear startup errors.

## Findings

**Affected Files and Lines:**
- `packages/convex/convex/auth.ts` (line 10): `process.env.SITE_URL!`
- `packages/convex/convex/auth.ts` (lines 44-45): `process.env.GOOGLE_CLIENT_ID!`, `GOOGLE_CLIENT_SECRET!`
- `apps/mirror/lib/auth-client.ts` (line 5): `process.env.NEXT_PUBLIC_SITE_URL!`
- `apps/mirror/lib/auth-server.ts` (lines 4-5): Multiple env vars

**Example:**
```typescript
const siteUrl = process.env.SITE_URL!;  // Crashes at runtime if undefined
```

## Proposed Solutions

### Option A: Zod Validation at Startup (Recommended)

**Pros:** Type-safe, clear error messages, validates early
**Cons:** Adds Zod dependency
**Effort:** Small
**Risk:** Low

```typescript
import { z } from "zod";

const envSchema = z.object({
  SITE_URL: z.string().url(),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
});

export const env = envSchema.parse(process.env);
```

### Option B: Manual Validation
Check each variable manually at startup.

**Pros:** No dependencies
**Cons:** More verbose, less type-safe
**Effort:** Small
**Risk:** Low

## Recommended Action

Implement Option A using Zod for comprehensive validation.

## Technical Details

**Affected Files:**
- `packages/convex/convex/auth.ts`
- `apps/mirror/lib/auth-client.ts`
- `apps/mirror/lib/auth-server.ts`

## Acceptance Criteria

- [x] Create env validation schema
- [x] Validate all required env vars at startup
- [x] Provide clear error messages for missing vars
- [x] Document required env vars in README

## Work Log

| Date | Action | Outcome |
|------|--------|---------|
| 2026-01-28 | Created from code review | Identified P2 architecture issue |
| 2026-01-28 | Implemented Zod validation | Added env.ts for convex and mirror apps |

## Resources

- Zod: https://zod.dev/
