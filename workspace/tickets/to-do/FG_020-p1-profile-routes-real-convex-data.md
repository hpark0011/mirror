---
id: FG_020
title: "Profile routes display real user data from Convex"
date: 2026-02-24
type: feature
status: to-do
priority: p1
description: "Replace MOCK_PROFILE usage in [username] route layout with Convex users.getByUsername query. Extend the Profile type to include avatarUrl. Determine profile ownership by comparing session user's authId with the profile's authId. Return 404 for unknown usernames. Keep MOCK_PROFILE as development fallback until all profiles are real."
dependencies:
  - FG_016
parent_plan_id: docs/plans/2026-02-24-feat-user-profile-onboarding-prd.md
acceptance_criteria:
  - "`apps/mirror/app/[username]/layout.tsx` queries `users.getByUsername` from Convex instead of using `MOCK_PROFILE` directly"
  - "Profile ownership is determined by comparing session user ID with the profile's authId (not just `isAuthenticated()`)"
  - "Unknown usernames return a 404 via `notFound()`"
  - "The `Profile` type in `apps/mirror/features/profile/lib/mock-profile.ts` includes `avatarUrl: string | null`"
  - "`pnpm build --filter=@feel-good/mirror` succeeds with no type errors"
owner_agent: "Next.js Frontend Engineer"
---

# Profile routes display real user data from Convex

## Context

The `[username]` route layout (`apps/mirror/app/[username]/layout.tsx:1-33`) currently uses `MOCK_PROFILE` for all profile data and determines ownership via `isAuthenticated()` alone (there's even a TODO comment about this at line 19-22):

```typescript
// TODO: SECURITY — isAuthenticated() only checks session presence, not profile ownership.
// When real profiles replace MOCK_PROFILE, change to:
//   const currentUser = await fetchAuthQuery(api.auth.getCurrentUser);
//   const isOwner = currentUser?._id === profile.userId;
const isOwner = await isAuthenticated();
```

With the `users.getByUsername` query (FG_016) available, profile routes can display real data and determine ownership properly.

## Goal

Profile pages at `/@{username}` display real user data from Convex. Ownership is determined by auth identity, not just session presence. Unknown usernames return 404.

## Scope

- Update `apps/mirror/app/[username]/layout.tsx` to query Convex for profile data
- Extend `Profile` type to include `avatarUrl: string | null` and make `media` optional
- Implement proper ownership check (session user authId vs profile authId)
- Maintain backward compatibility: fall back to `MOCK_PROFILE` for the `rick-rubin` username during transition

## Out of Scope

- Profile editing UI (separate feature)
- Article data from Convex (still uses `MOCK_ARTICLES`)
- Profile SEO / Open Graph metadata
- Avatar display component changes (just pass the URL through existing `Profile` type)

## Approach

The layout is a server component. Use Convex's server-side query capability (or `fetchQuery` from the Convex Next.js integration) to call `users.getByUsername`. If the query returns null and the username isn't the mock profile username, call `notFound()`.

For ownership, fetch the current auth user via `getCurrentUser` (already exported from `auth.ts`) and compare its ID with the profile's `authId`.

The `Profile` type needs `avatarUrl` added. The `media` field (video/poster) should become optional since real profiles won't have video content initially.

- **Effort:** Medium
- **Risk:** Medium — server-side Convex queries in Next.js server components need the right integration pattern (preloading or fetchQuery)

## Implementation Steps

1. Extend the `Profile` type in `apps/mirror/features/profile/lib/mock-profile.ts` — add `avatarUrl?: string | null`, make `media` optional
2. Update `ProfileInfo` and `ProfileShell` components to handle optional `media` and `avatarUrl`
3. In `apps/mirror/app/[username]/layout.tsx`, add Convex query for `users.getByUsername(username)`
4. Implement ownership check: get current auth user, compare authId with profile's authId
5. Map Convex user data to `Profile` type (username, name, bio, avatarUrl)
6. Keep fallback: if Convex returns null AND username === `MOCK_PROFILE.username`, use mock data
7. Remove the TODO comment about security and the `isAuthenticated()`-only ownership check
8. Run `pnpm build --filter=@feel-good/mirror`

## Constraints

- The layout must remain a server component (no `"use client"`)
- `MOCK_PROFILE` fallback stays until all users have real profiles — do not delete the mock
- `MOCK_ARTICLES` is unchanged (still mock data)
- Profile components (`ProfileShell`, `ProfileInfo`) must work with both mock and real data during transition

## Resources

- PRD: `docs/plans/2026-02-24-feat-user-profile-onboarding-prd.md` (Section 7)
- Layout: `apps/mirror/app/[username]/layout.tsx`
- Mock profile: `apps/mirror/features/profile/lib/mock-profile.ts`
- Profile shell: `apps/mirror/app/[username]/_components/profile-shell.tsx`
- Auth query: `packages/convex/convex/auth.ts` (`getCurrentUser`)
