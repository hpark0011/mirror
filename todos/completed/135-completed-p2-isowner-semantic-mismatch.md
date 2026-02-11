---
status: completed
priority: p2
issue_id: "135"
tags: [code-review, security, auth, mirror]
dependencies: []
---

# isOwner Uses isAuthenticated() Instead of Actual Ownership Check

## Problem Statement

`layout.tsx` line 18 sets `const isOwner = await isAuthenticated()`, which returns `true` for any logged-in user — not just the profile owner. When real multi-user profiles replace `MOCK_PROFILE`, any authenticated visitor will see owner-only CMS controls on every profile. This is a horizontal privilege escalation waiting to happen.

Currently safe because `if (username !== MOCK_PROFILE.username) notFound()` limits to a single hardcoded profile. But the context infrastructure and hook names (`useIsProfileOwner`) set an ownership contract that the implementation does not fulfill.

## Findings

- **Source:** security-sentinel (HIGH), architecture-strategist, pattern-recognition-specialist, kieran-typescript-reviewer, code-simplicity-reviewer, performance-oracle (6/6 agents)
- **Location:** `apps/mirror/app/[username]/layout.tsx` line 18
- **Evidence:** `isAuthenticated()` checks for a valid session, not user-to-profile relationship

## Resolution

Chose **Option A: Add TODO comment + prep type system** for the mock-data phase:

1. Added `// TODO: SECURITY` comment at `isOwner` assignment documenting the gap and showing the real fix pattern
2. Added optional `userId?: string` to `Profile` type — forward-compatible field for Convex-backed profiles
3. No behavioral change — owner CMS controls remain visible to all authenticated users during mock phase

## Acceptance Criteria

- [x] A TODO comment documents the security assumption at the `isOwner` assignment
- [ ] When real profiles exist, `isOwner` correctly returns `false` for non-owner visitors
- [ ] All Convex mutations gated by ownership independently verify server-side

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-11 | Created from PR #115 review | Never conflate "authenticated" with "authorized" — even in mock data phase, name the gap |
| 2026-02-11 | Completed: TODO comment + userId type prep | Deferred real fix until Convex-backed profiles land |

## Resources

- PR: https://github.com/hpark0011/feel-good/pull/115
