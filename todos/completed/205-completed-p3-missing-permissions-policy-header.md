---
status: completed
priority: p3
issue_id: "205"
tags: [code-review, pr-124, security, headers, mirror]
dependencies: ["200"]
---

# Missing Permissions-Policy header

## Problem Statement

The Mirror app sets several security headers (`X-Frame-Options`, `X-Content-Type-Options`, `HSTS`, `Referrer-Policy`) but is missing the `Permissions-Policy` header (formerly `Feature-Policy`). This header restricts access to browser features like camera, microphone, geolocation, and payment APIs.

## Findings

- **Location:** `apps/mirror/next.config.ts:5-20`
- Current security headers: X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Strict-Transport-Security
- Missing: Permissions-Policy
- The app doesn't use camera/microphone/geolocation, so these should be explicitly disabled

## Proposed Solutions

### Option A: Add Permissions-Policy header (Recommended)

```typescript
{
  key: "Permissions-Policy",
  value: "camera=(), microphone=(), geolocation=(), payment=()"
}
```

- **Effort:** Small
- **Risk:** Low

## Acceptance Criteria

- [x] Permissions-Policy header is present in all responses
- [x] Unnecessary browser features are explicitly disabled
- [x] No functionality is broken by the new restrictions

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-13 | Created from PR #124 security review | Permissions-Policy complements other security headers |
| 2026-02-15 | Implemented Option A in next.config.ts | Simple addition to existing headers array, build passes |
