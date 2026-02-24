---
id: FG_016
title: "User queries and mutations support profile management"
date: 2026-02-24
type: feature
status: to-do
priority: p1
description: "Create packages/convex/convex/users.ts with queries (getCurrentProfile, getByUsername, isUsernameTaken) and mutations (setUsername, updateProfile, setAvatar, completeOnboarding, generateAvatarUploadUrl). All mutations derive the current user via authComponent.getAuthUser. Username uniqueness enforced transactionally via by_username index."
dependencies:
  - FG_014
parent_plan_id: docs/plans/2026-02-24-feat-user-profile-onboarding-prd.md
acceptance_criteria:
  - "`packages/convex/convex/users.ts` exists and exports all 8 functions: getCurrentProfile, getByUsername, isUsernameTaken, setUsername, updateProfile, setAvatar, completeOnboarding, generateAvatarUploadUrl"
  - "All functions have `args` and `returns` validators defined (no missing validators)"
  - "setUsername validates format (lowercase alphanumeric + hyphens, 3-30 chars) and checks uniqueness via `withIndex('by_username', ...)`"
  - "getCurrentProfile resolves avatarStorageId to a URL via `ctx.storage.getUrl()` in the returned object"
  - "generateAvatarUploadUrl is a mutation that returns `ctx.storage.generateUploadUrl()`"
  - "`pnpm build --filter=@feel-good/convex` succeeds with no type errors"
owner_agent: "Convex Backend Engineer"
---

# User queries and mutations support profile management

## Context

The `users` table (FG_014) and auth triggers (FG_015) establish the data layer, but there are no functions for the frontend to read or modify profile data. The onboarding wizard (FG_018, FG_019) and profile routes (FG_020) all depend on these queries and mutations existing.

Key design decisions from the PRD:
- All mutations derive the current user via `authComponent.getAuthUser(ctx)` — no user ID passed from client
- Username uniqueness enforced transactionally (query index + check + patch in one mutation)
- `getCurrentProfile` resolves avatar URL server-side so clients don't need extra calls
- `generateAvatarUploadUrl` uses Convex's 3-step file upload pattern

## Goal

A complete set of queries and mutations exists in `users.ts` that the onboarding wizard and profile routes can consume directly.

## Scope

**Queries (public):**
- `getCurrentProfile` — returns authenticated user's full profile with resolved avatar URL
- `getByUsername` — public profile lookup by username
- `isUsernameTaken` — real-time availability check

**Mutations (public):**
- `setUsername` — validate format + uniqueness, patch user
- `updateProfile` — update bio and/or name
- `setAvatar` — set avatarStorageId, delete old file if replacing
- `completeOnboarding` — set `onboardingComplete = true`
- `generateAvatarUploadUrl` — return Convex upload URL

## Out of Scope

- Client-side hooks that consume these functions (onboarding tickets)
- Reserved username validation (handled client-side in Mirror, not in Convex)
- Rate limiting on queries (handled by Convex platform)

## Approach

Create a single `users.ts` file with all functions. Use `authComponent.getAuthUser(ctx)` for auth-gated functions. All queries use `withIndex` (never `filter`). Include full arg and return validators per `.claude/rules/convex.md`.

For `setUsername`, the uniqueness check is: query `by_username` index for existing user with that username. If found and it's not the current user, throw. This is safe because Convex mutations are transactional.

For `setAvatar`, if the user already has an `avatarStorageId`, delete the old file via `ctx.storage.delete()` before setting the new one.

- **Effort:** Medium
- **Risk:** Low

## Implementation Steps

1. Create `packages/convex/convex/users.ts` with imports from `_generated/server`, `convex/values`, and `./auth`
2. Implement 3 queries: `getCurrentProfile` (auth user → `by_authId` → resolve avatar URL), `getByUsername` (`by_username` → resolve avatar URL), `isUsernameTaken` (`by_username` → boolean)
3. Implement `setUsername` mutation — validate format via regex, check uniqueness via `by_username` index, patch user
4. Implement profile mutations: `updateProfile` (patch bio/name), `setAvatar` (delete old file if exists, patch storageId), `completeOnboarding` (set flag), `generateAvatarUploadUrl` (return upload URL)
5. Verify all 8 functions have explicit `args` and `returns` validators
6. Run `pnpm build --filter=@feel-good/convex`

## Constraints

- Every function must have explicit `args` and `returns` validators
- Never use `filter` — always use `withIndex`
- Auth-gated functions must throw if `getAuthUser` returns null
- `generateAvatarUploadUrl` must be a `mutation` (not action) since it uses `ctx.storage`

## Resources

- PRD: `docs/plans/2026-02-24-feat-user-profile-onboarding-prd.md` (Sections 3.3, 3.4)
- Convex rules: `.claude/rules/convex.md`
- Auth file: `packages/convex/convex/auth.ts` (for `authComponent` import)
