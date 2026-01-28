---
status: pending
priority: p1
issue_id: "003"
tags: [code-review, architecture, auth]
dependencies: []
---

# Hardcoded Email Domain in Convex Package

## Problem Statement

The `@feel-good/convex` package has email sender hardcoded to `auth@mirror.app`. Since this package is in `packages/` and designed to be shared across apps, other apps cannot use it without email branding conflicts.

## Findings

**File:** `packages/convex/convex/email.ts`

**Hardcoded Values (3 occurrences):**
```typescript
from: "Mirror <auth@mirror.app>",  // lines 18, 49, 79
```

**Impact:** Any other app in the monorepo that wants to use `@feel-good/convex` for authentication will send emails from "Mirror" branding, which is incorrect.

## Proposed Solutions

### Option A: Environment Variables (Recommended)
Make sender configurable via environment variables.

**Pros:** Flexible, easy to change per environment
**Cons:** Adds env var dependency
**Effort:** Small
**Risk:** Low

```typescript
const appName = process.env.APP_NAME ?? "Mirror";
const emailDomain = process.env.EMAIL_DOMAIN ?? "mirror.app";

// Usage:
from: `${appName} <auth@${emailDomain}>`,
```

### Option B: Configuration Object
Pass email config when initializing auth.

**Pros:** More explicit, type-safe
**Cons:** Requires API changes
**Effort:** Medium
**Risk:** Low

## Recommended Action

Implement Option A - use environment variables with Mirror defaults.

## Technical Details

**Affected File:** `packages/convex/convex/email.ts`

**Environment Variables to Add:**
- `APP_NAME` - Application name for email sender (default: "Mirror")
- `EMAIL_DOMAIN` - Domain for auth emails (default: "mirror.app")

## Acceptance Criteria

- [ ] Replace hardcoded values with environment variables
- [ ] Add sensible defaults for backwards compatibility
- [ ] Update documentation with required env vars
- [ ] Test email sending with different configurations

## Work Log

| Date | Action | Outcome |
|------|--------|---------|
| 2026-01-28 | Created from code review | Identified P1 architecture issue |

## Resources

- File: `packages/convex/convex/email.ts`
