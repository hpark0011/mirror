---
id: FG_048
title: "Post feed uses a dedicated summary read model"
date: 2026-03-08
type: perf
status: to-do
priority: p2
description: "The posts list query currently returns full rich-text bodies and the client derives previews reactively, which bloats the feed payload and blurs the boundary between list and detail contracts."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "`rg -c 'body: v.any\\(' packages/convex/convex/posts/helpers.ts` returns `1`."
  - "`rg -n 'preview|excerpt|plainText' packages/convex/convex/posts/helpers.ts packages/convex/convex/posts/queries.ts apps/mirror/features/posts/types.ts` returns matches."
  - "`rg -n 'getPlainText\\(post\\.body\\)' apps/mirror/features/posts/components/post-list-item.tsx` returns no matches."
  - "`pnpm --filter=@feel-good/convex check-types` succeeds."
  - "`pnpm build --filter=@feel-good/mirror` succeeds."
owner_agent: "Convex feed read-model performance specialist"
---

# Post feed uses a dedicated summary read model

## Context

Code review found that `packages/convex/convex/posts/queries.ts` returns full `body` values from `getByUsername`, while `packages/convex/convex/posts/helpers.ts` defines the summary validator with the same shape as detail. On the frontend, `apps/mirror/features/posts/context/post-workspace-context.tsx` subscribes to that full payload and `apps/mirror/features/posts/components/post-list-item.tsx` calls `getPlainText(post.body)` to derive a preview on the client.

That design makes the feed query heavier than necessary and couples list rendering to detail data. It also weakens the architecture boundary between “summary” and “full post” contracts that the article side already models more clearly.

## Goal

Give the posts feed its own lightweight summary read model so list rendering no longer subscribes to full rich-text bodies and detail data stays detail-only.

## Scope

- Split post summary and post detail return contracts.
- Move preview or excerpt derivation out of the list item component and into the backend read model.
- Keep the post detail route using the full rich-text body query.

## Out of Scope

- Adding post creation or editing UI.
- Expanding Tavus/chat context to use posts.
- Designing a new pagination API for the posts feed.

## Approach

Introduce a real summary contract in `packages/convex/convex/posts/helpers.ts` and map `getByUsername` to that contract in `packages/convex/convex/posts/queries.ts`. The summary shape should include the fields needed for feed rendering, including a server-derived preview field, while `getBySlug` remains the detail query that returns `body`.

- **Effort:** Medium
- **Risk:** Medium

## Implementation Steps

1. Refactor `packages/convex/convex/posts/helpers.ts` so the summary validator excludes `body` and exposes only feed fields plus a preview/excerpt field.
2. Update `packages/convex/convex/posts/queries.ts` so `getByUsername` returns ordered post summaries without shipping full rich-text bodies.
3. Update `apps/mirror/features/posts/types.ts` and `apps/mirror/features/posts/context/post-workspace-context.tsx` to consume the new summary contract.
4. Update `apps/mirror/features/posts/components/post-list-item.tsx` to render the provided preview field instead of deriving text from `post.body`.
5. Run `pnpm --filter=@feel-good/convex check-types`.
6. Run `pnpm build --filter=@feel-good/mirror`.

## Constraints

- Preserve owner-vs-public draft visibility behavior in the feed query.
- Keep `getBySlug` as the source of full-body post detail data.
- Do not reintroduce article-specific filtering or toolbar behavior into posts.

## Resources

- `packages/convex/convex/posts/helpers.ts`
- `packages/convex/convex/posts/queries.ts`
- `apps/mirror/features/posts/context/post-workspace-context.tsx`
- `apps/mirror/features/posts/components/post-list-item.tsx`
