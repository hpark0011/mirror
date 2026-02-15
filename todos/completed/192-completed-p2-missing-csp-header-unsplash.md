---
status: completed
priority: p2
issue_id: "192"
tags: [code-review, pr-124, security, csp, images]
dependencies: []
---

# No Content-Security-Policy header for external images

## Problem Statement

The PR adds `images.remotePatterns` for `images.unsplash.com` in `next.config.ts` for Next.js Image Optimization, but there's no corresponding `Content-Security-Policy` header with `img-src` directive. Browsers will load images from any origin without CSP restrictions.

## Findings

- `apps/mirror/next.config.ts` — `images.remotePatterns` allows `images.unsplash.com`
- No CSP headers configured in `next.config.ts` or middleware
- When real user content arrives, arbitrary image URLs could be injected into articles

## Proposed Solutions

### Option A: Add CSP header in next.config.ts (Recommended)

Add security headers including `img-src 'self' https://images.unsplash.com`:

```ts
headers: async () => [{
  source: "/(.*)",
  headers: [{
    key: "Content-Security-Policy",
    value: "img-src 'self' https://images.unsplash.com data:;"
  }]
}]
```

- Effort: Small
- Risk: Low

### Option B: Defer to production hardening

Add a todo for a comprehensive security headers pass when moving to real content.

- Effort: Small
- Risk: Medium (leaves gap until addressed)

## Acceptance Criteria

- [ ] CSP header restricts img-src to allowed domains
- [ ] Images from allowed sources still render
- [ ] No console CSP violation errors in dev

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-13 | Created from PR #124 code review | Next.js remotePatterns is optimization-only, not security |
