---
id: FG_184
title: "Collapse two identical generateArticleCoverVideo URL mutations into one"
date: 2026-05-08
type: refactor
status: to-do
priority: p2
description: "generateArticleCoverVideoUploadUrl and generateArticleCoverVideoPosterUploadUrl are byte-for-byte identical 4-line wrappers. Any future auth/rate-limit/logging change must be applied twice and will drift."
dependencies: []
parent_plan_id: PLAN_010
acceptance_criteria:
  - "`grep -n 'generateArticleCoverVideoUploadUrl\\|generateArticleCoverVideoPosterUploadUrl' packages/convex/convex/articles/mutations.ts` returns matches for at most one mutation (the consolidated one)"
  - "The new mutation returns `{ videoUrl: v.string(), posterUrl: v.string() }` and is called from use-article-cover-video-upload.ts"
  - "`pnpm --filter=@feel-good/convex test && pnpm --filter=@feel-good/mirror test:e2e -- article-cover-video` pass"
  - "`pnpm --filter=@feel-good/mirror lint && pnpm --filter=@feel-good/mirror build` exit 0"
owner_agent: "Convex Backend Engineer"
---

# Collapse Two Identical generateArticleCoverVideo URL Mutations Into One

## Context

`packages/convex/convex/articles/mutations.ts:676-692` defines two byte-for-byte identical mutations:

```ts
export const generateArticleCoverVideoUploadUrl = authMutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => await ctx.storage.generateUploadUrl(),
});

export const generateArticleCoverVideoPosterUploadUrl = authMutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => await ctx.storage.generateUploadUrl(),
});
```

The header comment claims they're separate "so the client can request both in parallel and so each orphan-cleanup path stays symmetric." Both arguments are weak:

- Parallel client calls work equally well with a single mutation invoked twice (or invoked once that returns both URLs internally — single network round-trip is faster).
- "Orphan-cleanup symmetry" refers to client-side bookkeeping by call order, not to mutation identity.

The cost: any future change (auth check, rate-limit, logging, audit trail) must be applied twice and will inevitably drift. This is the classic "premature symmetry" anti-pattern.

- **Source:** Code review of PLAN_010 article-cover-video branch
- **Location:** `packages/convex/convex/articles/mutations.ts:676-692`
- **Evidence:** Two identical 4-line bodies; client calls them via `Promise.all`.

## Goal

A single mutation issues both URLs in one round-trip. Client code uses the returned object directly.

## Scope

- Replace the two mutations with `generateArticleCoverVideoUploadUrls` returning `{ videoUrl, posterUrl }`.
- Update the client hook to call once and unpack.

## Out of Scope

- Consolidating with `generateArticleCoverImageUploadUrl` (different policy/lifecycle).
- Refactoring `uploadToStorage`.

## Approach

```ts
export const generateArticleCoverVideoUploadUrls = authMutation({
  args: {},
  returns: v.object({
    videoUrl: v.string(),
    posterUrl: v.string(),
  }),
  handler: async (ctx) => {
    const [videoUrl, posterUrl] = await Promise.all([
      ctx.storage.generateUploadUrl(),
      ctx.storage.generateUploadUrl(),
    ]);
    return { videoUrl, posterUrl };
  },
});
```

Client:
```ts
const generateUploadUrls = useMutation(api.articles.mutations.generateArticleCoverVideoUploadUrls);
const { videoUrl, posterUrl } = await generateUploadUrls();
```

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Add the new `generateArticleCoverVideoUploadUrls` mutation in `mutations.ts`.
2. Update `apps/mirror/features/articles/hooks/use-article-cover-video-upload.ts` (lines 144-149, 174-177) to use the consolidated mutation.
3. Delete the two old mutations.
4. Run `pnpm --filter=@feel-good/convex test`.
5. Run `pnpm --filter=@feel-good/mirror test:e2e -- article-cover-video` (assuming FG_178 has committed the fixture).
6. Run `pnpm --filter=@feel-good/mirror lint && pnpm --filter=@feel-good/mirror build`.

## Constraints

- This is a breaking API rename — the deleted mutation names are part of the public Convex API surface. The only known caller is the hook above.
- Two URLs in one round-trip is faster than two parallel mutations on cold connections.

## Resources

- Source: `packages/convex/convex/articles/mutations.ts:676-692`
- Caller: `apps/mirror/features/articles/hooks/use-article-cover-video-upload.ts:144-177`
