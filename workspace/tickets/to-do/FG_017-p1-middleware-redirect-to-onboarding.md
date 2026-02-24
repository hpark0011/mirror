---
id: FG_017
title: "Auth pages and middleware redirect to /onboarding instead of mock profile"
date: 2026-02-24
type: feature
status: to-do
priority: p1
description: "Update middleware.ts to redirect authenticated users on auth pages to /onboarding instead of /@rick-rubin. Update sign-in and sign-up pages to use /onboarding as fallback redirect. Add 'onboarding' to reserved usernames list. This is a pure routing change with no backend dependencies."
dependencies: []
parent_plan_id: docs/plans/2026-02-24-feat-user-profile-onboarding-prd.md
acceptance_criteria:
  - "`apps/mirror/middleware.ts` sets `DEFAULT_AUTHENTICATED_REDIRECT` to `'/onboarding'` (not `'/@rick-rubin'`)"
  - "`apps/mirror/app/(auth)/sign-in/page.tsx` uses `'/onboarding'` as the fallback redirect and does not import `MOCK_PROFILE`"
  - "`apps/mirror/app/(auth)/sign-up/page.tsx` uses `'/onboarding'` as the fallback redirect and does not import `MOCK_PROFILE`"
  - "`apps/mirror/lib/reserved-usernames.ts` includes `'onboarding'` in the `RESERVED_USERNAMES` set"
  - "`pnpm build --filter=@feel-good/mirror` succeeds (or type-checks if onboarding page doesn't exist yet)"
owner_agent: "Next.js Frontend Engineer"
---

# Auth pages and middleware redirect to /onboarding instead of mock profile

## Context

Currently, after authentication, users are redirected to the hardcoded mock profile `/@rick-rubin`:

- `apps/mirror/middleware.ts:6` — `DEFAULT_AUTHENTICATED_REDIRECT = "/@rick-rubin"`
- `apps/mirror/app/(auth)/sign-in/page.tsx:12` — `getSafeRedirectUrl(next, \`/@${MOCK_PROFILE.username}\`)`
- `apps/mirror/app/(auth)/sign-up/page.tsx:12` — same pattern

With real profiles, authenticated users need to go through onboarding first. The onboarding page itself handles the logic of redirecting to `/@{username}` if the profile is already complete (Option B from the PRD).

## Goal

Authenticated users landing on auth pages are redirected to `/onboarding`. The onboarding page (FG_018) will handle further routing based on profile state.

## Scope

- Change `DEFAULT_AUTHENTICATED_REDIRECT` in `middleware.ts` to `"/onboarding"`
- Change fallback redirect in `sign-in/page.tsx` to `"/onboarding"`, remove `MOCK_PROFILE` import
- Change fallback redirect in `sign-up/page.tsx` to `"/onboarding"`, remove `MOCK_PROFILE` import
- Add `"onboarding"` to `RESERVED_USERNAMES` set in `reserved-usernames.ts`

## Out of Scope

- The onboarding page itself (FG_018, FG_019)
- Checking profile completion state in middleware (deliberately avoided — Option B)
- Changes to the `[username]` profile routes

## Approach

Simple string replacements in 3 files plus one addition to the reserved usernames set. The sign-in and sign-up pages both import `MOCK_PROFILE` only for the username fallback — remove the import entirely and hardcode `"/onboarding"` as the fallback.

Note: Until the onboarding page exists (FG_018), navigating to `/onboarding` will 404. This is acceptable — the route will be created in a subsequent ticket.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. In `apps/mirror/middleware.ts:6`, change `DEFAULT_AUTHENTICATED_REDIRECT` from `"/@rick-rubin"` to `"/onboarding"`
2. In `apps/mirror/app/(auth)/sign-in/page.tsx`, replace `getSafeRedirectUrl(next, \`/@${MOCK_PROFILE.username}\`)` with `getSafeRedirectUrl(next, "/onboarding")` and remove the `MOCK_PROFILE` import
3. In `apps/mirror/app/(auth)/sign-up/page.tsx`, apply the same change as step 2
4. In `apps/mirror/lib/reserved-usernames.ts`, add `"onboarding"` to the `RESERVED_USERNAMES` set
5. Run `pnpm lint --filter=@feel-good/mirror` to catch unused imports
6. Run `pnpm build --filter=@feel-good/mirror` to verify no type errors

## Constraints

- Do not modify middleware auth logic (session checking, public route matching)
- Profile routes (`/@username`) must remain public — do not change the `isPublicRoute` check
- The `MOCK_PROFILE` export in `features/profile/lib/mock-profile.ts` should NOT be deleted yet — other files still use it

## Resources

- PRD: `docs/plans/2026-02-24-feat-user-profile-onboarding-prd.md` (Sections 5, 6)
- Middleware: `apps/mirror/middleware.ts`
- Sign-in: `apps/mirror/app/(auth)/sign-in/page.tsx`
- Sign-up: `apps/mirror/app/(auth)/sign-up/page.tsx`
- Reserved usernames: `apps/mirror/lib/reserved-usernames.ts`
