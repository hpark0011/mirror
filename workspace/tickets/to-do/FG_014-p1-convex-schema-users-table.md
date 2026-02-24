---
id: FG_014
title: "Convex schema defines users table with profile fields"
date: 2026-02-24
type: feature
status: to-do
priority: p1
description: "Create the first Convex schema file with an app-level users table. This table stores profile data (username, bio, avatar) linked to Better Auth's internal user via authId. Includes indexes for authId, email, and username lookups. Foundation for all profile features."
dependencies: []
parent_plan_id: docs/plans/2026-02-24-feat-user-profile-onboarding-prd.md
acceptance_criteria:
  - "`packages/convex/convex/schema.ts` exists and exports a default schema via `defineSchema`"
  - "users table defines all 7 fields: authId (string), email (string), username (optional string), name (optional string), bio (optional string), avatarStorageId (optional id _storage), onboardingComplete (boolean)"
  - "Three indexes exist: by_authId on [authId], by_email on [email], by_username on [username]"
  - "`pnpm build --filter=@feel-good/convex` succeeds with no type errors"
  - "No other tables are defined in the schema (Better Auth tables live in component namespace)"
owner_agent: "Convex Backend Engineer"
---

# Convex schema defines users table with profile fields

## Context

The Convex backend (`packages/convex/`) currently has no `schema.ts` file. Better Auth manages its own tables inside the component namespace (via `@convex-dev/better-auth`), but there is no app-level table for storing profile data like usernames, bios, or avatars. Every subsequent profile feature — auth triggers, queries, mutations, onboarding — depends on this schema existing first.

Relevant files:
- `packages/convex/convex/convex.config.ts` — app config, uses `betterAuth` and `resend` components
- `packages/convex/convex/auth.ts` — creates `authComponent` client, no schema reference yet

## Goal

A `schema.ts` file exists in the Convex directory defining a `users` table with all profile fields and indexes, and it compiles without errors.

## Scope

- Create `packages/convex/convex/schema.ts`
- Define `users` table with fields: `authId`, `email`, `username`, `name`, `bio`, `avatarStorageId`, `onboardingComplete`
- Define indexes: `by_authId`, `by_email`, `by_username`

## Out of Scope

- Auth triggers that insert into this table (FG_015)
- Queries and mutations against this table (FG_016)
- Any frontend changes

## Approach

Create the schema file following Convex conventions from `.claude/rules/convex.md`. Use `defineSchema` and `defineTable` from `convex/server`, with validators from `convex/values`. Optional fields use `v.optional()`. The `avatarStorageId` uses `v.id("_storage")` to reference Convex's built-in file storage system.

Username uniqueness cannot be enforced at the schema level (Convex has no unique constraints) — it will be enforced transactionally in the mutation (FG_016).

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Create `packages/convex/convex/schema.ts` with imports from `convex/server` and `convex/values`
2. Define the `users` table with all 7 fields using appropriate validators
3. Add three indexes: `by_authId` on `["authId"]`, `by_email` on `["email"]`, `by_username` on `["username"]`
4. Export as default via `defineSchema({ users: defineTable(...) })`
5. Run `pnpm build --filter=@feel-good/convex` to verify no type errors

## Constraints

- Follow Convex schema conventions from `.claude/rules/convex.md`
- Index names must include all field names (e.g., `by_authId` not `by_auth`)
- Do not define Better Auth's tables — they are managed by the component

## Resources

- PRD: `docs/plans/2026-02-24-feat-user-profile-onboarding-prd.md` (Section 3.1)
- Convex rules: `.claude/rules/convex.md`
- Existing config: `packages/convex/convex/convex.config.ts`
