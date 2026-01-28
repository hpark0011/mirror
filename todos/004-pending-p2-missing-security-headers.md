---
status: done
priority: p2
issue_id: "004"
tags: [code-review, security, nextjs]
dependencies: []
---

# Missing Security Headers in Next.js Config

## Problem Statement

The Next.js configuration is empty with no security headers configured. The application is vulnerable to clickjacking, XSS, MIME sniffing, and downgrade attacks.

## Findings

**File:** `apps/mirror/next.config.ts`

**Current Config:**
```typescript
const nextConfig: NextConfig = {
  /* config options here */
};
```

**Missing Headers:**
- Content-Security-Policy (CSP)
- X-Frame-Options
- X-Content-Type-Options
- Strict-Transport-Security (HSTS)
- Referrer-Policy

## Proposed Solutions

### Option A: Add Headers to next.config.ts (Recommended)

**Pros:** Centralized, applies to all routes
**Cons:** None significant
**Effort:** Small
**Risk:** Low

```typescript
const nextConfig: NextConfig = {
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
      ],
    },
  ],
};
```

## Recommended Action

Add security headers to `next.config.ts`.

## Technical Details

**Affected File:** `apps/mirror/next.config.ts`

## Acceptance Criteria

- [x] Add X-Frame-Options: DENY
- [x] Add X-Content-Type-Options: nosniff
- [x] Add Referrer-Policy
- [x] Add HSTS header
- [ ] Test headers with security scanner

## Work Log

| Date | Action | Outcome |
|------|--------|---------|
| 2026-01-28 | Created from code review | Identified P2 security issue |
| 2026-01-28 | Implemented security headers | Added all 4 headers to next.config.ts |

## Resources

- OWASP Security Headers: https://owasp.org/www-project-secure-headers/
