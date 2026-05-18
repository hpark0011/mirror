---
id: FG_258
title: "getByUsername inline-image URL resolution is bounded per request"
date: 2026-05-18
type: perf
status: to-do
priority: p2
description: "getByUsername resolves inline-image storage URLs for every post body, so even with the hundred-row cap the storage fan-out is order posts times images-per-post, hitting roughly a thousand storage calls for content-heavy users."
dependencies: []
acceptance_criteria:
  - "getByUsername no longer issues unbounded per-post inline-image ctx.storage.getUrl calls (either `body` is removed from the list return shape or a documented per-post image cap is applied)"
  - "`pnpm --filter=@feel-good/convex run verify:codegen` passes (any validator change reflected in _generated)"
  - "`pnpm --filter=@feel-good/convex test` passes for posts query specs"
  - "`pnpm --filter=@feel-good/mirror build` passes (list rendering adjusted if the body shape changed)"
---

# getByUsername inline-image URL resolution is bounded per request

## Context

`packages/convex/convex/posts/queries.ts` `getByUsername` runs two sequential `Promise.all` sweeps after the 100-row cap: cover URLs (bounded, ≤300 calls) and `rewriteInlineImageSrc` over every post `body`. The inline-image sweep issues one `ctx.storage.getUrl` per unique inline image **per post**, and that per-post count is uncapped — a user with 100 posts × ~10 inline images each triggers ~1,000+ storage calls per list load (queries.ts ~109-111).

Found in code review (performance reviewer, confidence 0.85). The 100-row cap bounds the outer fan-out but not the inner one; list rows rarely render full inline-image body content anyway.

## Scope

- Bound the inline-image fan-out for the list query (one outcome — pick one approach below).

## Approach

Preferred: drop `body` from the list return shape (`postSummaryReturnValidator` / the summary serializer) and let list rows render a lighter preview; full inline-image bodies are already resolved by `getBySlug` for the detail page. Fallback if the list genuinely needs body: cap inline-image rewrites to the first N nodes per post with a comment documenting the bound.

## Implementation Steps

1. Read `posts/queries.ts` `getByUsername`, `posts/helpers.ts` (`postSummaryReturnValidator`, `serializePost`, `rewriteInlineImageSrc`), and the list consumers `post-list-item.tsx` / `post-layout.tsx` / `post-body.tsx`.
2. Choose the approach (body-out preferred). If body-out: remove `body` from the summary validator + serializer; adjust the list rendering path and the optimistic-update filter (now in `use-delete-post.ts` after FG_252) accordingly.
3. Run `pnpm --filter=@feel-good/convex run verify:codegen`, `pnpm --filter=@feel-good/convex test`, `pnpm --filter=@feel-good/mirror build`.

## Constraints

- If `body` is removed from the list shape, update every list consumer (PostBody/PostLayout, the `withOptimisticUpdate` filter in `use-delete-post.ts`, any e2e assertions) so the list still renders correctly.
- Read the current state of `use-delete-post.ts` before editing — FG_252 already consolidated the optimistic-update block there.

## Out of Scope

- The owner 100-row cap / pagination migration (separate, documented FG_248 tradeoff).
