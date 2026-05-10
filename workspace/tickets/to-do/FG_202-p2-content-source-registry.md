---
id: FG_202
title: "Content sources use a shared registry"
date: 2026-05-10
type: refactor
status: to-do
priority: p2
description: "Chat retrieval, embedding ingestion, content routing, and agent navigation each hardcode supported content kinds, making future sources like projects or social posts require coordinated edits across too many files."
dependencies: []
parent_plan_id: workspace/plans/2026-05-10-chat-relevant-article-retrieval-plan.md
acceptance_criteria:
  - "A central content source registry exists and declares articles, posts, and bioEntries with their embedding and navigation capabilities."
  - "embeddingSourceTableValidator, backfillEmbeddings, getContentForEmbedding, and fetchChunksByIds use registry-derived source metadata instead of independent hardcoded source lists."
  - "findRelevantPublishedContent, resolvePublishedContentCandidates, navigateToContent, and client content-kind helpers consume registry-derived navigable content metadata instead of duplicating the articles/posts union."
  - "A unit test proves every navigable registry entry can build a canonical href and every non-navigable entry is excluded from navigateToContent results."
  - "A drift test fails if a source is added to the registry without corresponding embedding serialization or navigation capability metadata."
  - "`pnpm --filter=@feel-good/convex test -- chat/__tests__/tools.test.ts chat/__tests__/ragContext.test.ts embeddings/__tests__/bio-source.test.ts` exits 0."
  - "`pnpm --filter=@feel-good/convex check-types && pnpm build --filter=@feel-good/mirror` exit 0."
owner_agent: "Convex Chat Architecture Engineer"
---

# Content Sources Use a Shared Registry

## Context

The relevant-article retrieval work made the chat agent capable of finding published articles and posts semantically, then opening them through the right content panel. The architecture is sound, but the supported content source list is still spread across several modules instead of being declared once.

Current hardcoded seams include `packages/convex/convex/embeddings/schema.ts:20-24`, where `embeddingSourceTableValidator` allows only `articles`, `posts`, and `bioEntries`; `packages/convex/convex/embeddings/actions.ts:111-160`, where `backfillEmbeddings` manually schedules those three source tables; `packages/convex/convex/chat/relevantContent.ts:36-39`, where only articles and posts are navigable; and `apps/mirror/features/content/types.ts:14-39`, where the client content route kinds are limited to posts and articles.

That means adding a future source like `projects` or `socialPosts` would not automatically enter the RAG ingestion pipeline or become agent-openable in the content panel. Each new content type would require parallel edits to Convex validators, embedding fetch/serialize logic, semantic search filtering, tool schemas, tool resolvers, href helpers, route helpers, and client content-panel routes. The proposed registry makes those extension points explicit and testable before more content types arrive.

## Goal

All content source metadata lives behind a shared registry so embedding ingestion, semantic retrieval, agent navigation, and content-panel routing derive from one declared source map. Adding a new content type should require adding one registry entry plus the source-specific serializer/resolver, with drift tests catching missing pieces.

## Scope

- Add a typed content source registry for current sources: `articles`, `posts`, and `bioEntries`.
- Separate source-table identity from navigable route identity so future names like `socialPosts` can route to `/social-posts` without leaking table names into URLs.
- Refactor embedding ingestion and chat retrieval to consume registry helpers for source capabilities.
- Refactor agent tool schemas and route helpers so navigable content kinds are derived from the registry.
- Add drift tests that lock registry coverage across embedding, navigation, and href generation.

## Out of Scope

- Adding a new `projects` or `socialPosts` product feature.
- Changing the public URL shape for existing articles or posts.
- Refactoring editor UI, content list UI, or publish/unpublish behavior beyond what is necessary to consume registry metadata.

## Approach

Create a pure shared registry module, likely under `packages/convex/convex/content/`, that can be imported by both Convex backend code and the Next.js client without pulling in Convex runtime APIs. Each entry should describe stable metadata such as source table, route segment, display label, whether the source is RAG-indexable, whether it is navigable in the content panel, and whether it has a draft/published lifecycle.

Keep source-specific database reads and serializers outside the pure registry, but wire them through registry keys so the shared infrastructure can iterate registered sources safely. Bio entries should remain indexable but non-navigable; articles and posts should remain indexable and navigable.

- **Effort:** Medium
- **Risk:** Medium

## Implementation Steps

1. Add a pure registry module such as `packages/convex/convex/content/sourceRegistry.ts` with typed entries for `articles`, `posts`, and `bioEntries`, including table key, route segment, labels, indexable/navigable flags, and lifecycle metadata.
2. Update `packages/convex/convex/embeddings/schema.ts`, `packages/convex/convex/embeddings/queries.ts`, `packages/convex/convex/embeddings/actions.ts`, and `packages/convex/convex/embeddings/mutations.ts` to consume registry-derived source values and helpers.
3. Update `packages/convex/convex/chat/relevantContent.ts`, `packages/convex/convex/chat/toolQueries.ts`, and `packages/convex/convex/chat/tools.ts` so semantic search, candidate resolution, and tool schemas derive navigable content kinds from the registry.
4. Update `packages/convex/convex/content/href.ts` and `apps/mirror/features/content/types.ts` to use registry route metadata while preserving existing `/@<username>/articles/<slug>` and `/@<username>/posts/<slug>` hrefs.
5. Add or update tests in `packages/convex/convex/chat/__tests__/tools.test.ts`, `packages/convex/convex/chat/__tests__/ragContext.test.ts`, `packages/convex/convex/embeddings/__tests__/bio-source.test.ts`, and `apps/mirror/features/content/__tests__/types.test.ts` to prove registry coverage and non-navigable bio behavior.
6. Run `pnpm --filter=@feel-good/convex test -- chat/__tests__/tools.test.ts chat/__tests__/ragContext.test.ts embeddings/__tests__/bio-source.test.ts`.
7. Run `pnpm --filter=@feel-good/convex check-types && pnpm build --filter=@feel-good/mirror`.

## Constraints

- The registry module must stay pure: no Convex `ctx`, generated API imports, React imports, or Next.js runtime imports.
- The LLM-visible tool schemas must not expose `userId`, `ownerId`, `username`, or any other user identifier.
- Bio entries must remain available to ambient RAG but must not become detail-page navigable unless a separate product decision creates a bio-detail route.
- Existing article and post hrefs must remain stable.

## Resources

- Plan: `workspace/plans/2026-05-10-chat-relevant-article-retrieval-plan.md`
- Embedding source validator: `packages/convex/convex/embeddings/schema.ts`
- Embedding actions: `packages/convex/convex/embeddings/actions.ts`
- Semantic retrieval: `packages/convex/convex/chat/relevantContent.ts`
- Tool resolver: `packages/convex/convex/chat/toolQueries.ts`
- Tool definitions: `packages/convex/convex/chat/tools.ts`
- Client route helpers: `apps/mirror/features/content/types.ts`
