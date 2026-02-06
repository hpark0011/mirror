---
status: completed
priority: p3
issue_id: "082"
tags: [auth, otp, testing, code-review]
dependencies: []
---

# Address Skipped E2E Tests

## Problem Statement

2 of 8 E2E tests are `test.skip` — the two that actually verify OTP flow behavior (step transition after email submit, back button). The running tests only verify element presence on page load. This means the most critical auth flows have zero automated coverage.

## Affected Files

- `apps/mirror/e2e/auth.spec.ts` (lines 37, 54)

## Acceptance Criteria

- [x] Step transition test runs in CI (not skipped)
- [x] Back button test runs in CI (not skipped)
- [x] Tests don't require a running Convex backend

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-06 | Created from PR #104 multi-agent review (typescript reviewer) | Skipped tests tend to stay skipped permanently |
| 2026-02-06 | Completed: unskipped both tests, added `page.route()` mocking for `**/api/auth/email-otp/send-verification-otp` endpoint returning `{ status: true }`. | Playwright `route.fulfill()` is the cleanest way to mock Better Auth API responses without a running backend. |
