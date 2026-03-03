---
id: FG_011
title: "Profile owner check grants owner access to all authenticated users"
date: 2026-02-12
type: fix
status: to-do
priority: p3
description: "isOwner = isAuthenticated() in the profile layout treats any logged-in user as the profile owner, exposing draft articles and owner-only filter options to non-owners."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "`grep -n 'isOwner.*isAuthenticated' apps/mirror/app/\\[username\\]/layout.tsx` returns no matches"
  - "`grep -n 'isOwner.*profile.userId' apps/mirror/app/\\[username\\]/layout.tsx` returns a match showing proper ownership comparison"
  - "`pnpm build --filter=@feel-good/mirror` exits 0"
owner_agent: "Auth Guard Security Agent"
---

# Profile owner check grants owner access to all authenticated users

## Context

In `apps/mirror/app/[username]/layout.tsx:18-22`, `isOwner = await isAuthenticated()` means any logged-in user viewing any profile is treated as the owner. They see draft articles and owner-only filter options. This was discovered during PR #120 code review and has an existing TODO at line 18.

The server component at `page.tsx` sends ALL articles (including drafts) to any authenticated user as a result.

## Goal

Only the actual profile owner sees draft articles and owner-only filters. Non-owner authenticated users see the same view as unauthenticated visitors.

## Scope

- Replace `isOwner = await isAuthenticated()` with a proper ownership comparison against the profile's userId
- Ensure draft articles are filtered out for non-owners in the server component

## Out of Scope

- Rate limiting or additional authorization layers
- Profile privacy settings beyond owner/non-owner distinction
- Migration from MOCK_PROFILE to real profile data (this fix should work with whatever profile source exists)

## Approach

When real profiles replace MOCK_PROFILE, implement proper ownership check:

```typescript
const currentUser = await fetchAuthQuery(api.auth.getCurrentUser);
const isOwner = currentUser?._id === profile.userId;
```

- **Effort:** Medium (blocked on real profile data)
- **Risk:** Low

## Constraints

- Must not break the existing authenticated user experience for actual profile owners
- Must work with the current profile data source (MOCK_PROFILE or real)

## Resources

- PR #120 code review where this was first identified
- `apps/mirror/app/[username]/layout.tsx:18-22` — existing TODO
