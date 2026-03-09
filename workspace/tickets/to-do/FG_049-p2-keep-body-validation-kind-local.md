---
id: FG_049
title: "Shared content schema keeps body validation kind-specific"
date: 2026-03-08
type: refactor
status: to-do
priority: p2
description: "The new shared content schema hard-codes `body: v.any()` into the base fields, which pushes an unvalidated document shape into every future content kind instead of letting each kind own its own body contract."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "`rg -n 'body:' packages/convex/convex/content/schema.ts` returns no matches."
  - "`rg -n 'body:' packages/convex/convex/articles/schema.ts packages/convex/convex/posts/schema.ts` returns matches."
  - "`pnpm --filter=@feel-good/convex check-types` succeeds."
owner_agent: "Convex schema boundary refactor specialist"
---

# Shared content schema keeps body validation kind-specific

## Context

The new shared content layer in `packages/convex/convex/content/schema.ts` currently places `body: v.any()` inside `contentBaseFields`. That means the base abstraction for all content kinds now assumes an unvalidated body payload by default.

This was flagged during architecture review because the shared layer should represent only truly universal fields, while content-specific document shapes belong to their respective domains. Leaving `body` in the base fields makes future content kinds harder to model cleanly and weakens schema ownership boundaries.

## Goal

Narrow the shared content schema to common metadata only, so each content kind explicitly owns its own body field and validator.

## Scope

- Remove `body` from `contentBaseFields`.
- Define body ownership in the article and post schema modules.
- Update dependent validators or schema composition code so the refactor remains type-safe.

## Out of Scope

- Designing a full strict Tiptap JSON validator if that work is larger than this boundary refactor.
- Reworking article-only or post-only fields beyond the body ownership change.
- Adding new content kinds.

## Approach

Refactor the shared schema module so it exports only universal scalar fields and limits, then compose article and post table definitions from those base fields plus kind-local body definitions. If return validators or mutations currently rely on the shared `body` field, update them to import the local validator instead of inheriting it from the base layer.

- **Effort:** Medium
- **Risk:** Low

## Implementation Steps

1. Remove `body` from `packages/convex/convex/content/schema.ts`.
2. Add explicit body fields or validators in `packages/convex/convex/articles/schema.ts` and `packages/convex/convex/posts/schema.ts`.
3. Update any helper or mutation validators in `packages/convex/convex/articles/*` and `packages/convex/convex/posts/*` that currently depend on shared body ownership.
4. Verify the schema composition still builds and type-checks cleanly.
5. Run `pnpm --filter=@feel-good/convex check-types`.

## Constraints

- Keep shared helpers focused on truly common content concerns.
- Do not merge article-only and post-only document rules back into a generic content abstraction.
- Preserve compatibility with the existing stored article and post data.

## Resources

- `packages/convex/convex/content/schema.ts`
- `packages/convex/convex/articles/schema.ts`
- `packages/convex/convex/posts/schema.ts`
- `packages/convex/convex/articles/helpers.ts`
- `packages/convex/convex/posts/helpers.ts`
