---
status: pending
priority: p3
issue_id: "018"
tags: [code-review, security, validation]
dependencies: []
---

# Enforce HTTPS Scheme in URL Validation

## Problem Statement

Zod's `.url()` validator accepts any valid URL scheme including `javascript:`, `data:`, and `file:` URLs. While the current usage passes URLs to Convex client (which expects HTTPS), stricter validation would prevent misconfiguration.

## Findings

**Location:** `apps/mirror/lib/env/client.ts` (lines 10-13)

**Current code:**
```typescript
NEXT_PUBLIC_CONVEX_URL: z
  .string()
  .url("NEXT_PUBLIC_CONVEX_URL must be a valid URL"),
```

**Risk:** Low - Convex client would fail with invalid schemes, but error would be less clear than a Zod validation error.

## Proposed Solutions

### Option A: Add HTTPS refinement
```typescript
NEXT_PUBLIC_CONVEX_URL: z
  .string()
  .url()
  .refine((url) => url.startsWith("https://"), {
    message: "NEXT_PUBLIC_CONVEX_URL must use HTTPS",
  }),
```
- **Pros:** Clear validation error, prevents misconfiguration
- **Cons:** Slightly more verbose
- **Effort:** Small
- **Risk:** Low

### Option B: Keep current validation
- **Pros:** Simpler code
- **Cons:** Less specific error on misconfiguration
- **Effort:** None
- **Risk:** Low

## Recommended Action

(To be filled during triage)

## Technical Details

**Affected Files:**
- `apps/mirror/lib/env/client.ts`

## Acceptance Criteria

- [ ] URL validation rejects non-HTTPS URLs with clear error
- [ ] Existing valid URLs continue to work

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-29 | Created from code review | Security sentinel noted validation permissiveness |

## Resources

- PR branch: feel-good/012826-auth_ui
