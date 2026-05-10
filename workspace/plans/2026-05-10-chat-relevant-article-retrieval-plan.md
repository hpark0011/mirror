---
id: PLAN_011
slug: chat-relevant-article-retrieval
title: "Let clone chat find and open relevant articles"
date: 2026-05-10
type: fix
status: draft
branch: codex/chat-relevant-article-retrieval
worktree: null
scope: "Teach the clone agent to search the owner's published articles/posts by relevance, then use the existing navigation dispatcher to open the best matching article instead of guessing the posts tab or only checking latest content."
apps: [mirror]
packages: [convex]
verification_tier: 5
---
## 1. Summary

The reported failure is a retrieval and tool-policy gap in clone chat. When a visitor asks a topical project question like "What is greyboard ai?", the agent has enough data in principle: published articles are embedded into `contentEmbeddings`, and `streamResponse` already injects RAG chunks into the system prompt. But the agent's action surface only has "latest article/post", "open section list", and "navigate to known kind plus slug". There is no tool that means "find the relevant published content for this query".

The fix is to add a semantic lookup tool that searches the current profile owner's published content by relevance and returns canonical navigation data. The agent will then reuse the existing `navigateToContent` tool and existing client watcher/dispatcher path. This preserves the repo's "two routes, one dispatcher" invariant while closing the gap that caused the agent to check the posts tab and stop.

## 2. Current State

- `packages/convex/convex/chat/actions.ts` embeds the user message, runs `ctx.vectorSearch("contentEmbeddings", "by_embedding", { filter: q.eq("userId", profileOwnerId) })`, fetches chunks, and appends them to the system prompt via `buildRagContext`.
- `packages/convex/convex/embeddings/queries.ts:fetchChunksByIds` returns only `title`, `slug`, and `chunkText`. It does not expose `sourceTable` or `sourceId`, so the prompt cannot reliably distinguish article chunks from post chunks.
- `packages/convex/convex/chat/tools.ts` exposes:
  - `getLatestPublished({ kind })`, which only answers "latest".
  - `navigateToContent({ kind, slug })`, which requires the model to already know both values.
  - `openProfileSection({ section })`, which opens the list view and is not intended for specific content.
- `packages/convex/convex/chat/helpers.ts` currently teaches the agent to use `getLatestPublished` for the latest article/post and `openProfileSection` for list-level requests. It does not teach a relevance-search workflow.
- Existing e2e coverage proves "show me your latest article" can navigate, but there is no regression test for "semantic question opens the relevant article".

## 3. Design

Add one new server-side lookup tool:

```ts
findRelevantPublishedContent({
  query: string,
  kind?: "articles" | "posts",
  limit?: number
}) -> Array<{
  kind: "articles" | "posts";
  slug: string;
  title: string;
  href: string;
  excerpt: string;
  score: number;
}>
```

The LLM-visible schema must not include `userId`, `ownerId`, `username`, or any other user identifier. `buildCloneTools(profileOwnerId, ...)` closes over the server-derived profile owner exactly like the existing tools do.

The tool should:

1. Embed the visitor's query with the same embedding model/dimensions used by RAG.
2. Run vector search against `contentEmbeddings` filtered to `profileOwnerId`.
3. Fetch chunk metadata including `sourceTable`, `sourceId`, `title`, `slug`, and `chunkText`.
4. Keep only navigable published sources (`articles` and `posts`; exclude `bioEntries`).
5. Optionally filter by `kind`.
6. Dedupe multiple chunks from the same source, preserving the highest score.
7. Resolve candidates through an internal query that re-checks `(profileOwnerId, kind, slug)`, published status, owner username, and server canonical `href`.

This is intentionally a lookup tool, not a new navigation verb. If a match is found and the user asked to see/show/open the source, or the answer should be grounded in a specific article, the agent calls:

```ts
navigateToContent({ kind: match.kind, slug: match.slug })
```

That means `useAgentIntentWatcher`, `useCloneActions`, chat-aware href preservation, and content-panel opening continue to be handled by the existing dispatcher path.

## 4. Implementation Steps

### Step 1 - Return source metadata from RAG chunk reads

Update `packages/convex/convex/embeddings/queries.ts`.

- Extend `fetchChunksByIds` return values with:
  - `sourceTable`
  - `sourceId`
  - existing `title`, `slug`, `chunkText`
- Keep `slug` optional for `bioEntries`.
- Update validators and existing tests in `chat/__tests__/ragContext.test.ts`and `embeddings/__tests__/bio-source.test.ts` as needed.

### Step 2 - Make RAG context identify article/post sources

Update `packages/convex/convex/chat/actions.ts`.

- Widen `buildRagContext` chunk input to include `sourceTable`.
- For article/post chunks, include a compact source hint in the hidden prompt context, for example: `Source: article slug <slug>` or `Source: post slug <slug>`.
- Keep bio chunks linkless and non-navigable.
- Preserve `RAG_CONTEXT_MAX_CHARS` and existing truncation behavior.

This alone gives the model better context, but it is not the whole fix. The agent still needs a reliable lookup tool so it does not have to infer from prompt text alone.

### Step 3 - Add reusable semantic search helper

Create a Node-side helper near the chat action/tool code, for example `packages/convex/convex/chat/relevantContent.ts`.

Responsibilities:

- Export constants for result limit and score threshold, or reuse the existing RAG constants where practical.
- Embed the query using `google.textEmbeddingModel(EMBEDDING_MODEL)` with `EMBEDDING_DIMENSIONS`.
- Run vector search filtered to `userId === profileOwnerId`.
- Fetch chunk metadata via the widened `fetchChunksByIds`.
- Filter to `articles`/`posts`, apply optional kind, dedupe by `sourceTable + sourceId`, and produce candidate rows with excerpts.

Keep all code server-side. Do not expose this as a public client query.

### Step 4 - Add candidate resolution query

Update `packages/convex/convex/chat/toolQueries.ts`.

- Add an internal query such as `resolvePublishedContentCandidates`.
- Args:
  - `userId: v.id("users")`
  - `candidates: v.array(v.object({ kind, slug, score, excerpt }))`
- For each candidate, resolve by `by_userId_and_slug`, require `status === "published"`, fetch the owner username once, and build href via `buildContentHref`.
- Return only valid, published, same-owner rows.
- Preserve input ranking order.

This repeats the safety checks from `resolveBySlug` in batch form and prevents stale embeddings or hallucinated slugs from becoming navigable output.

### Step 5 - Register `findRelevantPublishedContent`

Update `packages/convex/convex/chat/tools.ts`.

- Add the tool to `buildCloneTools`.
- Input schema keys must be only `query`, optional `kind`, and optional `limit`.
- The execute path calls the semantic search helper and the candidate resolver.
- Return an array, not a single forced match, so the model can say when several articles are plausible.
- Cap `limit` server-side even if the model passes a larger value.

Add input-schema invariant tests alongside the existing tool tests:

- No `userId`, `user_id`, `ownerId`, `username`, or nested identifier keys.
- Exposes only the intended keys.
- `kind` enum is only `articles | posts`.

### Step 6 - Update system-prompt tool vocabulary

Update `packages/convex/convex/chat/helpers.ts`.

- Add `findRelevantPublishedContent` to the fixed tools vocabulary.
- Teach the workflow in plain prose:
  - Use it for topical/project/article questions, not only "latest" requests.
  - If the user asks to see/show/open/read the relevant source, call `navigateToContent` with the returned `kind` and `slug`.
  - If no relevant content is returned, say there is no matching article/post instead of opening the posts list by guess.
- Keep owner-write vocabulary unchanged.
- Update helper tests to assert the new tool name survives prompt truncation.

### Step 7 - Add regression coverage

Unit coverage:

- `packages/convex/convex/chat/__tests__/helpers.test.ts`
  - Prompt includes `findRelevantPublishedContent`.
  - Prompt preserves it under budget pressure.
- `packages/convex/convex/chat/__tests__/tools.test.ts`
  - New tool input-schema invariant.
  - Candidate resolver excludes drafts.
  - Candidate resolver excludes cross-user rows.
  - Candidate resolver scopes same slug across users and across kind.
- `packages/convex/convex/chat/__tests__/ragContext.test.ts`
  - Article/post chunks include source-kind and slug hints.
  - Bio chunks still do not emit navigable source hints.

E2E coverage:

- Add `apps/mirror/e2e/chat-agent-relevant-article.authenticated.spec.ts`.
- Seed or rely on a published article whose title/body clearly matches "greyboard ai" or "software with less input".
- Prompt:
  - `What is greyboard ai? Pull up the relevant article if you have one.`
- Assertions:
  - URL changes to `/@<username>/articles/<expected-slug>`.
  - URL preserves `chat=1` and `conversation=...`.
  - Article detail `h1` is visible and matches the expected article title.
  - URL does not go to `/posts` or `/articles` list only.

If existing article fixtures are too generic, extend the test-only `/test/ensure-article-fixtures` path to seed a dedicated published Greyboard article and schedule its embedding generation. Keep that endpoint gated by `PLAYWRIGHT_TEST_SECRET`.

## 5. Hard Verification

Run unit tests for the changed Convex chat/embedding surfaces:

```bash
pnpm --filter=@feel-good/convex test -- chat/__tests__/helpers.test.ts chat/__tests__/tools.test.ts chat/__tests__/ragContext.test.ts embeddings/__tests__/bio-source.test.ts
```

Run app build and lint per Tier 5:

```bash
pnpm build --filter=@feel-good/mirror
pnpm lint --filter=@feel-good/mirror
```

Run the targeted Playwright CLI regression:

```bash
pnpm --filter=@feel-good/mirror test:e2e apps/mirror/e2e/chat-agent-relevant-article.authenticated.spec.ts
```

Hard e2e assertions:

- The chat sends the Greyboard/project prompt.
- The page URL becomes `/@<username>/articles/<expected-slug>`.
- The URL keeps `chat=1` and `conversation=...`.
- The article detail heading is visible.
- The final path is not `/posts`, `/posts/<slug>`, or the bare `/articles`list.

After code changes, run:

```bash
graphify update .
```

## 6. Constraints And Non-Goals

- Do not expose any user identifier in tool schemas.
- Do not navigate directly from server tools. The new lookup tool returns data; `navigateToContent` remains the only slug-level navigation tool.
- Do not surface drafts. Drafts remain absent from embeddings and must be rejected again during candidate resolution.
- Do not add a public search endpoint for visitors in this plan.
- Do not solve general web search or external Greyboard site crawling.
- Do not rely on title string matching only. The core lookup should be semantic vector retrieval, with title/body matching only as a future optional boost.
- Do not change owner-write tools.

## 7. Risks

- The new lookup duplicates the embedding/vector search that `streamResponse`already performs before the model call. That is acceptable for correctness, but if latency becomes noticeable, a later optimization can pass per-turn RAG candidates into the model/tool context more directly.
- Convex test does not implement `ctx.vectorSearch`, so the actual semantic ranking needs Playwright coverage against a real Convex deployment. Unit tests should still lock the safety-critical pieces: schema shape, candidate resolution, draft exclusion, and cross-user isolation.
- LLM-backed e2e tests can be flaky. Keep the prompt explicit ("pull up the relevant article") and assert structural outcomes (URL and heading), not exact response prose.

## 8. Done Criteria

- Asking about Greyboard-like project content causes the agent to retrieve a relevant article instead of checking the posts tab.
- When a relevant published article exists, the right panel opens that article through `navigateToContent`.
- When no relevant article/post exists, the agent says so without inventing a posts result.
- Cross-user and draft isolation remain covered by tests.
- Build, lint, targeted unit tests, targeted Playwright test, and graphify update all pass.