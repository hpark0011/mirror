---
id: FG_015
title: "Auth triggers sync Better Auth users to app users table"
date: 2026-02-24
type: feature
status: to-do
priority: p1
description: "Wire Better Auth lifecycle triggers (onCreate, onUpdate, onDelete) on authComponent in auth.ts. On user creation, insert an app-level users row with authId, email, and onboardingComplete=false. On update, sync email changes. On delete, cascade-delete the app user row and any stored avatar file."
dependencies:
  - FG_014
parent_plan_id: docs/plans/2026-02-24-feat-user-profile-onboarding-prd.md
acceptance_criteria:
  - "`packages/convex/convex/auth.ts` registers `user.onCreate`, `user.onUpdate`, and `user.onDelete` triggers on `authComponent`"
  - "onCreate trigger inserts a row into the `users` table with `authId`, `email`, and `onboardingComplete: false`"
  - "onUpdate trigger patches the app user's `email` field when the auth user's email changes"
  - "onDelete trigger deletes the app user row and calls `ctx.storage.delete()` on avatarStorageId if present"
  - "`pnpm build --filter=@feel-good/convex` succeeds with no type errors"
owner_agent: "Convex Backend Engineer"
---

# Auth triggers sync Better Auth users to app users table

## Context

Better Auth manages its own internal user table inside the component namespace. When a user signs up via magic link or OTP, a record is created in Better Auth's table, but nothing exists in the app-level `users` table (created in FG_014). The `@convex-dev/better-auth` package exposes lifecycle trigger hooks (`user.onCreate`, `user.onUpdate`, `user.onDelete`) that fire when auth-level events occur.

The `authComponent` client is already created in `packages/convex/convex/auth.ts:13`:
```typescript
export const authComponent = createClient<DataModel>(components.betterAuth);
```

This ticket wires up triggers so that every auth user automatically gets a corresponding app user row.

## Goal

When a user signs up, an app-level `users` row is automatically created with `onboardingComplete: false`. Email changes and deletions are kept in sync.

## Scope

- Add `user.onCreate` trigger: insert app user with `{ authId, email, onboardingComplete: false }`
- Add `user.onUpdate` trigger: sync email changes to app user
- Add `user.onDelete` trigger: delete app user + stored avatar file

## Out of Scope

- User queries and mutations (FG_016)
- Onboarding UI that sets the remaining fields
- Handling of edge cases like duplicate auth events (Convex mutations are transactional)

## Approach

Use the `@convex-dev/better-auth` trigger API on `authComponent`. The triggers are registered as internal mutations that receive the auth user data. Each trigger queries the `users` table via the `by_authId` index to find the corresponding app user, then performs the appropriate operation.

Research the exact trigger API from `@convex-dev/better-auth` docs — the PRD references `onCreate`/`onUpdate`/`onDelete` as the documented pattern. The triggers may be configured in the `createAuth` function or on the `authComponent` client directly.

- **Effort:** Medium
- **Risk:** Medium — trigger API shape needs verification against `@convex-dev/better-auth` docs

## Implementation Steps

1. Research the `@convex-dev/better-auth` trigger registration API (check package docs/types for exact method signatures)
2. In `packages/convex/convex/auth.ts`, add the `user.onCreate` trigger that inserts into the `users` table
3. Add the `user.onUpdate` trigger that queries `by_authId` and patches email
4. Add the `user.onDelete` trigger that queries `by_authId`, deletes avatar from storage if present, and deletes the user row
5. Run `pnpm build --filter=@feel-good/convex` to verify compilation
6. Verify trigger registration doesn't break existing auth flow by checking `createAuth` still exports correctly

## Constraints

- Do not modify the existing Better Auth configuration (social providers, rate limits, plugins)
- Triggers must be idempotent — handle the case where an app user already exists for a given authId
- Use `ctx.db.query("users").withIndex("by_authId", ...)` — never use `filter`

## Resources

- PRD: `docs/plans/2026-02-24-feat-user-profile-onboarding-prd.md` (Section 3.2)
- Auth file: `packages/convex/convex/auth.ts`
- Convex rules: `.claude/rules/convex.md`
