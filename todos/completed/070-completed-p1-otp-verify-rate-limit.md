---
status: completed
priority: p1
issue_id: "070"
tags: [auth, security, otp, rate-limiting, code-review]
dependencies: []
---

# Add Rate Limit on OTP Verification Endpoint

## Problem Statement

The OTP verification endpoint needed explicit rate limiting and attempt-based invalidation.

## Corrections from Research

The original todo had two inaccuracies:
1. Better Auth's option is `allowedAttempts` (not `maxAttempts`), and the **default is already 3** — OTPs were never unprotected.
2. The emailOTP plugin already declares its own rate limit for `/sign-in/email-otp` at 3/60s — it wasn't falling back to the global 10/60s default.

Despite this, making the configuration explicit is defensive best practice.

## Affected Files

- `packages/convex/convex/auth.ts`

## Acceptance Criteria

- [x] OTP verification endpoint has a custom rate limit rule (`/sign-in/email-otp`: 5/300s)
- [x] `allowedAttempts: 5` is configured in the emailOTP plugin
- [x] After 5 failed verification attempts, the OTP is invalidated
- [x] Rate limit path matches the actual Better Auth endpoint path

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-06 | Created from PR #104 multi-agent review (security sentinel) | 6-digit OTP with global 10/60s rate limit allows ~50 guesses per OTP lifetime |
| 2026-02-06 | Research: Better Auth option is `allowedAttempts` (default 3), plugin already declares rate limits | Always verify option names from source — the todo's `maxAttempts` doesn't exist |
| 2026-02-06 | Added explicit `allowedAttempts: 5` + `/sign-in/email-otp` customRule at 5/300s | Making defaults explicit is good defensive practice even when they're already active |
