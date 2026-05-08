---
id: FG_174
title: "getByUsername must resolve all three cover URLs in one Promise.all instead of three sequential rounds"
date: 2026-05-08
type: perf
status: to-do
priority: p1
description: "The query now does three separate await Promise.all rounds for cover-image, cover-video, and cover-poster URLs. They run sequentially instead of concurrently, tripling the minimum query latency before the response can return."
dependencies: []
parent_plan_id: PLAN_010
acceptance_criteria:
  - "`grep -c 'await Promise.all' packages/convex/convex/articles/queries.ts` returns at most 1 inside getByUsername (the inline-image resolution can stay if it's a different scope)"
  - "The cover URL resolution uses a single Promise.all of triplets: `Promise.all(visible.map(a => Promise.all([resolve(image), resolve(video), resolve(poster)])))`"
  - "`pnpm --filter=@feel-good/convex test` passes the existing query unit tests"
  - "`pnpm --filter=@feel-good/mirror lint && pnpm --filter=@feel-good/mirror build` exit 0"
owner_agent: "Convex Backend Engineer"
---

# getByUsername Must Resolve All Three Cover URLs in One Promise.all Instead of Three Sequential Rounds

## Context

`packages/convex/convex/articles/queries.ts:37-51` does three sequential rounds:

```ts
const coverImageUrls = await Promise.all(
  visible.map((a) => resolveArticleCoverImageUrl(ctx, a.coverImageStorageId)),
);
const coverVideoUrls = await Promise.all(
  visible.map((a) => resolveArticleCoverImageUrl(ctx, a.coverVideoStorageId)),
);
const coverVideoPosterUrls = await Promise.all(
  visible.map((a) =>
    resolveArticleCoverImageUrl(ctx, a.coverVideoPosterStorageId),
  ),
);
```

Each round waits on its slowest URL. Total elapsed time is at minimum 3× a single-round latency, even though all 3N resolutions could race in one round.

`resolveStorageUrl` correctly short-circuits on `undefined` (no wasted call for video-free articles), so the cost is not "150 calls per 50 articles" — it's "the round-trip serialization across three Promise.all boundaries that don't need to be sequential."

- **Source:** Code review of PLAN_010 article-cover-video branch
- **Location:** `packages/convex/convex/articles/queries.ts:37-51`
- **Evidence:** Three separate `await` boundaries where one would suffice.

## Goal

`getByUsername` resolves all three cover URLs per article concurrently in one Promise.all, eliminating the sequential await chain.

## Scope

- Collapse the three Promise.all rounds into one Promise.all of triplets per article.
- Update the consumers (the article summary mapping at lines 53-67) to unpack the triplet.

## Out of Scope

- Resolving inline body image URLs in the same Promise.all (separate scope, different code path).
- Changing the `resolveArticleCoverImageUrl` helper signature.
- Optimizing `getBySlug` (it resolves one row, no N×3 amplification).

## Approach

```ts
const coverUrlTriplets = await Promise.all(
  visible.map((a) =>
    Promise.all([
      resolveArticleCoverImageUrl(ctx, a.coverImageStorageId),
      resolveArticleCoverImageUrl(ctx, a.coverVideoStorageId),
      resolveArticleCoverImageUrl(ctx, a.coverVideoPosterStorageId),
    ]),
  ),
);

return visible.map((article, i) => {
  const [coverImageUrl, coverVideoUrl, coverVideoPosterUrl] = coverUrlTriplets[i]!;
  return { …, coverImageUrl, coverVideoUrl, coverVideoPosterUrl };
});
```

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. In `packages/convex/convex/articles/queries.ts`, replace lines 37-51 with the single Promise.all-of-triplets above.
2. Update the `visible.map((article, i) => …)` block (lines 53-67) to unpack from the triplet array.
3. Run `pnpm --filter=@feel-good/convex test` — existing tests should still pass without modification.
4. Run `pnpm --filter=@feel-good/mirror lint && pnpm --filter=@feel-good/mirror build`.
5. Optional: open a profile with several articles in dev (Chrome MCP) and verify the article list still renders all covers correctly.

## Constraints

- Output shape MUST be identical — the `articleSummaryReturnValidator` does not change.
- Per-article URL resolution order does not matter (each article is independent).

## Resources

- Source: `packages/convex/convex/articles/queries.ts:19-69`
- Helper: `packages/convex/convex/content/helpers.ts` `resolveStorageUrl`
