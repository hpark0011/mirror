---
id: FG_047
title: "Rick Rubin demo seed reconciles records individually"
date: 2026-03-08
type: fix
status: to-do
priority: p2
description: "The Rick Rubin demo seed currently treats any existing article, post, or conversation as proof that the whole seed set exists, so reruns can leave the demo profile permanently incomplete after partial inserts or manual cleanup."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "`rg -n 'first\\(' packages/convex/convex/seed.ts` returns no matches."
  - "`rg -n 'slug: article\\.slug|slug: post\\.slug|title: convo\\.title|unique\\(' packages/convex/convex/seed.ts` returns matches showing per-record reconciliation."
  - "`pnpm --filter=@feel-good/convex check-types` succeeds."
owner_agent: "Convex seed integrity specialist"
---

# Rick Rubin demo seed reconciles records individually

## Context

Code review of the new content architecture found that the Rick Rubin seed helpers in `packages/convex/convex/seed.ts` short-circuit on `.first()` for `articles`, `posts`, and `conversations`. That means a single existing row is treated as “already seeded,” even when the rest of the expected demo data is missing.

This makes `seed:rick-rubin` only conditionally idempotent. After a partial failure, manual delete, or local data drift, rerunning the seed command can leave the profile with missing articles, missing posts, or missing demo conversations while still reporting success.

## Goal

Make the Rick Rubin demo seed reconcile each expected record independently so reruns restore missing demo data without duplicating records that already exist.

## Scope

- Replace collection-level `.first()` guards in the Rick Rubin content/conversation seed helpers.
- Reconcile seeded articles and posts by slug.
- Reconcile seeded conversations by a deterministic seeded key such as title.

## Out of Scope

- Writing new demo copy for Rick Rubin content.
- Adding a root-level seed alias outside `packages/convex`.
- Reworking unrelated non-demo seed flows.

## Approach

Refactor the helper layer in `packages/convex/convex/seed.ts` so each helper checks the existing seeded keys for the Rick Rubin user and inserts only the missing records. Keep the aggregate `seedRickRubinDemo` mutation intact, but make each underlying helper truly safe to rerun after partial state.

- **Effort:** Medium
- **Risk:** Medium

## Implementation Steps

1. Update `packages/convex/convex/seed.ts` so article seeding looks up existing Rick Rubin article slugs and inserts only missing slugs from `SEED_ARTICLES`.
2. Update `packages/convex/convex/seed.ts` so post seeding looks up existing Rick Rubin post slugs and inserts only missing slugs from `SEED_POSTS`.
3. Update `packages/convex/convex/seed.ts` so conversation seeding looks up existing seeded conversation identifiers for the profile owner and inserts only missing demo conversations.
4. Keep `seedRickRubinDemo`, `seedRickRubinArticles`, `seedRickRubinPosts`, and `seedRickRubinConversations` delegating to the refactored helpers without changing their public names.
5. Run `pnpm --filter=@feel-good/convex check-types`.

## Constraints

- Do not delete existing Rick Rubin data as part of reconciliation.
- Keep the existing `convex run seed:seedRickRubinDemo` entrypoint working.
- Preserve the current seeded user identity and existing seed content constants.

## Resources

- `packages/convex/convex/seed.ts`
- `packages/convex/package.json`
- `packages/convex/README.md`
