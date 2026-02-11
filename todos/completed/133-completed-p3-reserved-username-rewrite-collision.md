---
status: completed
priority: p3
issue_id: "133"
tags: [code-review, routing, mirror, pr-114]
dependencies: []
---

# Reserved Username Collision via `/@` Rewrites

## Problem Statement

The `/@:username` rewrite in `next.config.ts` maps any `/@<name>` path to `/<name>`. When `<name>` matches an existing route (e.g., `dashboard`, `sign-in`, `sign-up`, `api`), the rewrite bypasses the `[username]` route tree and lands on the static route instead. This is mostly harmless today because:

- The dashboard layout has its own server-side auth guard (defense in depth)
- Auth pages are already public
- No real user registration exists yet

The only observable issue is a minor UX inconsistency: visiting `/@dashboard` while unauthenticated redirects to `/sign-in` without the `?next=/dashboard` param (layout redirect vs middleware redirect).

This becomes a real concern when user registration is added — a user signing up as `dashboard` or `sign-in` would have an unreachable profile page.

## Findings

- **Source:** chatgpt-codex-connector review comment on PR #114
- **Location:** `apps/mirror/next.config.ts` lines 21-24 (rewrite rules), `apps/mirror/middleware.ts` line 24 (`startsWith("/@")` check)
- **Evidence:** `/@dashboard` rewrites to `/dashboard`, which resolves to `(protected)/dashboard` (static segment priority) instead of `[username]` layout. Middleware treats it as public due to `startsWith("/@")`, but dashboard layout's own `isAuthenticated()` check still protects it.

## Proposed Solutions

### Option A: Disallow reserved usernames at registration (Recommended)

When user registration is implemented, validate usernames against a blocklist of reserved route segments.

```ts
const RESERVED_USERNAMES = ["dashboard", "sign-in", "sign-up", "api", "admin", "settings"];

function isValidUsername(username: string): boolean {
  return !RESERVED_USERNAMES.includes(username);
}
```

- **Effort:** Small
- **Risk:** None — standard practice for vanity URL systems

### Option B: Add exclusions to rewrite rules

```ts
rewrites: async () => [
  { source: "/@:username((?!dashboard|sign-in|sign-up|api).*)", destination: "/:username" },
  { source: "/@:username((?!dashboard|sign-in|sign-up|api).*)/:slug", destination: "/:username/:slug" },
],
```

- **Effort:** Small
- **Risk:** Low — regex in rewrite rules is harder to maintain as routes grow

### Option C: Tighten middleware `/@` check

Add username format validation in middleware to reject reserved names early.

- **Effort:** Small
- **Risk:** Low — adds logic to middleware that may belong in the application layer

## Recommended Action

Option A when user registration is built. No action needed now with mock data.

## Technical Details

- **Affected files:** `apps/mirror/next.config.ts`, `apps/mirror/middleware.ts`
- **Affected routes:** Any static route that could collide with a username (`dashboard`, `sign-in`, `sign-up`, `api`)

## Acceptance Criteria

- [x] Reserved route names cannot be registered as usernames
- [x] `/@dashboard` either shows a 404 or is handled gracefully
- [x] No route collision between usernames and static segments

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-11 | Created from PR #114 code review | Vanity URL systems need reserved name blocklists |
| 2026-02-11 | Implemented Option A — reserved username blocklist in `lib/reserved-usernames.ts`, guard in `[username]/layout.tsx` | Use `Set` for O(1) lookups on blocklists |

## Resources

- PR: #114 — feat(mirror): move profile view to public /@username route
