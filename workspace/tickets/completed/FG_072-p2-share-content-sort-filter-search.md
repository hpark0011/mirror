---
id: FG_072
title: "Articles and posts share sort, filter, and search logic from content"
date: 2026-04-23
type: refactor
status: completed
priority: p2
description: "use-article-sort and use-post-sort are byte-for-byte identical (10 lines each, SortOrder type duplicated). filterArticles and filterPosts implement the same category + datePreset + publishedStatus pipeline. use-article-search and use-post-search implement the same scored-search algorithm. Sort lives in utils/post-filter.ts for posts but inline in use-article-pagination for articles. Promote the shared logic into the existing apps/mirror/features/content/ feature so both consumers can inject feature-specific config."
dependencies: []
parent_plan_id: workspace/research/convex-nextjs-client-feature-org.md
acceptance_criteria:
  - "apps/mirror/features/content/hooks/use-content-sort.ts exists and is consumed by both articles and posts"
  - "apps/mirror/features/content/utils/content-filter.ts exists and is consumed by both articles and posts"
  - "apps/mirror/features/content/hooks/use-content-search.ts exists and is consumed by both articles and posts"
  - "apps/mirror/features/articles/hooks/use-article-sort.ts and apps/mirror/features/posts/hooks/use-post-sort.ts no longer exist (or are thin wrappers under 5 lines that re-export from content)"
  - "grep -n 'export type SortOrder' apps/mirror/features/articles apps/mirror/features/posts -r returns no matches (the type lives only in content)"
  - "pnpm --filter=@feel-good/mirror build exits 0"
  - "pnpm --filter=@feel-good/mirror lint produces 0 errors"
owner_agent: "general-purpose"
---

# Articles and posts share sort, filter, and search logic from content

## Context

The research report at `workspace/research/convex-nextjs-client-feature-org.md` identified three duplicated abstractions across the articles and posts feature modules:

- **Sort:** `apps/mirror/features/articles/hooks/use-article-sort.ts` (10 lines) and `apps/mirror/features/posts/hooks/use-post-sort.ts` (10 lines) are byte-for-byte identical `useState` wrappers over a `SortOrder` type that is also defined independently in each file.
- **Filter:** `apps/mirror/features/articles/utils/article-filter.ts` (107 lines) and `apps/mirror/features/posts/utils/post-filter.ts` (119 lines) implement the same category + `publishedDatePreset` + `createdDatePreset` + `publishedStatus` pipeline. `posts/utils/post-filter.ts` additionally contains `sortPosts`, while sort logic for articles lives inline inside `apps/mirror/features/articles/hooks/use-article-pagination.ts` — split inconsistent.
- **Search:** `apps/mirror/features/articles/hooks/use-article-search.ts` (72 lines) and `apps/mirror/features/posts/hooks/use-post-search.ts` (83 lines) implement the same debounce + precompute + score-sort algorithm independently.

`apps/mirror/features/content/` already exists with shared `utils/date-preset.ts` and `utils/format-date.ts` (verified). Articles already re-exports `date-preset.ts` from `content/`, so the sharing pattern is established.

## Goal

A single source of truth in `apps/mirror/features/content/` owns sort, filter, and search logic. Articles and posts consume it with feature-specific config (e.g. category lists, document shape) injected. Sort placement asymmetry is resolved (sort lives in `content/hooks/`, not split between `utils/` and a pagination hook).

## Scope

- Create `apps/mirror/features/content/hooks/use-content-sort.ts` exporting the `SortOrder` type and the hook.
- Create `apps/mirror/features/content/utils/content-filter.ts` exporting a generic `filterContent<T>(items, predicateConfig)` and a `sortContent<T>` if useful.
- Create `apps/mirror/features/content/hooks/use-content-search.ts` exporting a generic `useContentSearch<T>(items, scoreFn)` or similar shape.
- Update articles and posts to consume from content. Delete the original files (or leave thin `<5 line` re-export shims if a consumer convention requires it).
- Move `sortPosts` out of `posts/utils/post-filter.ts` and `apps/mirror/features/articles/hooks/use-article-pagination.ts` so both consume the same `sortContent` from `content/`.

## Out of Scope

- Adding a new third consumer feature.
- Changing the filter UI, sort UI, or search UI in either articles or posts.
- Convex schema or query changes.
- Renaming or moving `content/utils/date-preset.ts` or `format-date.ts`.

## Approach

Define the generic shapes in `content/` so the consumer feature passes its own `T` (Article, Post) and any feature-specific config (e.g. categories, scoring fn). Keep the type signatures narrow — generic over the document type, not over arbitrary behavior — so the abstraction is real, not speculative.

Migrate one consumer at a time (suggest articles first since its split is wider): make articles use the new `content/` exports, run build + lint, then do the same for posts. Delete the original files once both consumers have moved.

- **Effort:** Medium
- **Risk:** Medium

## Implementation Steps

1. Read all six source files end-to-end to identify the genuine shared shape vs. feature-specific config (category enum, score weights, etc.).
2. Create `apps/mirror/features/content/hooks/use-content-sort.ts` with the `SortOrder` type and the shared hook. Re-export from `apps/mirror/features/content/index.ts` if that's the public-surface convention.
3. Create `apps/mirror/features/content/utils/content-filter.ts` with the generic filter function and (if shared) the sort function.
4. Create `apps/mirror/features/content/hooks/use-content-search.ts` with the generic search hook.
5. Migrate `apps/mirror/features/articles/` to consume the three new content exports. Delete `apps/mirror/features/articles/hooks/use-article-sort.ts` and `apps/mirror/features/articles/hooks/use-article-search.ts`. Move sort logic out of `use-article-pagination.ts` into the consumer wiring.
6. Migrate `apps/mirror/features/posts/` to consume the same. Delete `apps/mirror/features/posts/hooks/use-post-sort.ts` and `apps/mirror/features/posts/hooks/use-post-search.ts`. Move `sortPosts` and the filter pipeline body out of `posts/utils/post-filter.ts` (the file may then be deleted or reduced to feature-specific config).
7. Run `pnpm --filter=@feel-good/mirror build && pnpm --filter=@feel-good/mirror lint`.
8. Verify in Chrome MCP per `.claude/rules/verification.md` Tier 4: filter, sort, and search both the articles list and the posts list; behavior must be identical to before.

## Constraints

- The shared abstraction must be generic over the document type (`<T>`) — do not hardcode `Article | Post` unions.
- Consumers must inject feature-specific config (categories, scoring weights, etc.) rather than the shared module knowing about each feature.
- No `<T extends Article | Post>` or similar leakage of feature types into `content/`.
- Sort placement asymmetry is resolved — sort logic must not live inside `use-article-pagination.ts` after the refactor.
- No change to Convex queries or document shapes.

## Resources

- Research report (motivation): `workspace/research/convex-nextjs-client-feature-org.md`
- Existing shared infrastructure: `apps/mirror/features/content/utils/date-preset.ts`, `apps/mirror/features/content/utils/format-date.ts`, `apps/mirror/features/content/components/list-toolbar/`
- Article-side consumers: `apps/mirror/features/articles/hooks/{use-article-sort,use-article-search,use-article-pagination,use-article-filter}.ts`, `apps/mirror/features/articles/utils/article-filter.ts`
- Post-side consumers: `apps/mirror/features/posts/hooks/{use-post-sort,use-post-search,use-post-filter}.ts`, `apps/mirror/features/posts/utils/post-filter.ts`
- Convention: `.claude/rules/file-organization.md`
