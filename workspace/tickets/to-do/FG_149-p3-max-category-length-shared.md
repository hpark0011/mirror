---
id: FG_149
title: "MAX_CATEGORY_LENGTH is shared between client schema and server validators"
date: 2026-05-05
type: refactor
status: to-do
priority: p3
description: "Zod client schema sets MAX_CATEGORY_LENGTH=64 while the server uses 100; client rejects 65-100-char categories the server would accept."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "`MAX_CATEGORY_LENGTH` is exported from a single canonical module (e.g. `packages/convex/convex/content/schema`) and imported by both `apps/mirror/features/articles/lib/schemas/article-metadata.schema.ts` and `packages/convex/convex/articles/mutations.ts`."
  - "`grep -rn 'MAX_CATEGORY_LENGTH = ' apps/ packages/` shows exactly one definition."
  - "`pnpm build --filter=@feel-good/mirror` and `pnpm --filter=@feel-good/convex exec tsc --noEmit` pass."
owner_agent: "frontend / convex engineer"
---

# MAX_CATEGORY_LENGTH is shared between client schema and server validators

## Context

Surfaced by the PR #34 code review (`code-review-pr34` batch; data-integrity reviewer). `apps/mirror/features/articles/lib/schemas/article-metadata.schema.ts:13` defines `const MAX_CATEGORY_LENGTH = 64`. `packages/convex/convex/articles/mutations.ts:23` defines `const MAX_CATEGORY_LENGTH = 100`. The values are not shared — each is a standalone magic number.

`MAX_TITLE_LENGTH` and `MAX_SLUG_LENGTH` are already exported from `packages/convex/convex/content/schema` and consumed by both sides; `MAX_CATEGORY_LENGTH` was missed.

**Risk:** the client rejects valid 65-100-char categories the server would accept, blocking a user who edits an existing article whose category was set via direct mutation or markdown import. The divergence will silently grow if either constant is updated independently.

## Goal

A single source of truth for `MAX_CATEGORY_LENGTH` shared by the Zod schema and the Convex mutation.

## Scope

- Export `MAX_CATEGORY_LENGTH` from the canonical module (alongside MAX_TITLE/MAX_SLUG).
- Import it in both the client schema and the server mutation.

## Out of Scope

- Changing the actual value (pick whichever side has the correct value — likely 100 to match server).
- Renaming the constant.

## Approach

Mirror the existing MAX_TITLE/MAX_SLUG export pattern.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Locate the existing exports of `MAX_TITLE_LENGTH` and `MAX_SLUG_LENGTH` (likely `packages/convex/convex/content/schema` or similar).
2. Add `export const MAX_CATEGORY_LENGTH = 100;` (or 64, depending on product decision) alongside.
3. Update `packages/convex/convex/articles/mutations.ts:23` to import the constant instead of defining it locally.
4. Update `apps/mirror/features/articles/lib/schemas/article-metadata.schema.ts:13` similarly.
5. Verify the package's `exports` map exposes the canonical module to the consuming app.
6. Run typecheck and build.

## Constraints

- Pick a single canonical value — if 64 wins, update the server; if 100 wins, update the Zod max; do not leave them divergent.
- Must not change the schema field shape on the server.

## Resources

- PR #34: https://github.com/hpark0011/mirror/pull/34
- Existing pattern: `MAX_TITLE_LENGTH`, `MAX_SLUG_LENGTH`
