---
status: completed
priority: p1
issue_id: "069"
tags: [auth, security, convex, code-review]
dependencies: []
---

# Convert Email Actions to internalAction

## Problem Statement

All three email-sending Convex functions (`sendMagicLink`, `sendVerificationEmail`, `sendOTP`) are exported as `action()` — making them part of the public Convex API. Anyone with the deployment URL can call them directly, sending unlimited emails through the Resend account to arbitrary addresses (spam/phishing vector, cost abuse, domain reputation damage).

## Affected Files

- `packages/convex/convex/email.ts` (lines 73, 96, 119)
- `packages/convex/convex/auth.ts` (imports need updating from `api.email.*` to `internal.email.*`)

## Acceptance Criteria

- [x] `sendMagicLink`, `sendVerificationEmail`, `sendOTP` use `internalAction`
- [x] `auth.ts` imports from `internal.email.*` instead of `api.email.*`
- [x] Email sending still works end-to-end
- [x] The functions are not callable from the public Convex client

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-06 | Created from PR #104 multi-agent review (security sentinel) | Convex `action()` is always public; use `internalAction()` for server-to-server calls |
| 2026-02-06 | Implemented: `action` → `internalAction` in email.ts, `api.email.*` → `internal.email.*` in auth.ts, removed unused `api` import | Straightforward change — `ctx.runAction` works identically with internal functions |
