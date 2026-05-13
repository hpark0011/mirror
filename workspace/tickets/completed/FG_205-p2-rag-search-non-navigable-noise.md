---
id: FG_205
title: "Bio and contact chunks don't starve published content in RAG search"
date: 2026-05-13
type: perf
status: completed
priority: p2
description: "findRelevantPublishedContent's vector search includes non-navigable sources (bio + contact) in its 16-result window. When those rows score high, they consume slots before being dropped by the post-search navigability filter, starving genuinely-matching published articles and posts that score just below the cutoff."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "A regression test in packages/convex/convex/chat/__tests__/ seeds a user with high-similarity bioEntries and contactEntries rows alongside a lower-scoring published article (or post) and asserts findRelevantPublishedContent returns at least one navigable candidate when args.kind is undefined."
  - "The same regression test asserts the seeded bio/contact rows are NOT present in the returned candidates (negative check — confirms the filter drops them, not just deprioritizes)."
  - "pnpm --filter=@feel-good/convex exec vitest run convex/chat/__tests__ passes."
  - "grep -n 'navigable' packages/convex/convex/chat/relevantContent.ts returns at least one new occurrence (the fix references the navigability concept at the vector-search call site, not just the post-filter)."
  - "Reverting the production fix and re-running the new test causes it to fail (proves the test actually exercises the regression, not a tautology). Document the temporary revert + test failure in the PR description."
owner_agent: "Convex backend engineer with familiarity in Convex vector search filters and the chat/RAG retrieval path"
---

# Bio and contact chunks don't starve published content in RAG search

## Context

Surfaced in PR #91 (contact panel) by Codex's automated review on
`packages/convex/convex/content/sourceRegistry.ts:103`. The new
`contactEntries` source is registered as `indexable: true` +
`lifecycle: "always-indexable"` + `navigation: { navigable: false }` —
the same shape as `bioEntries`. Both flow through the same chat RAG
retrieval path.

The problem lives at
`packages/convex/convex/chat/relevantContent.ts:60-90`. The primary
`vectorSearch` call uses a filter of `q.eq("userId", args.profileOwnerId)`
when `args.kind` is undefined and takes the top
`RELEVANT_CONTENT_VECTOR_LIMIT = 16` results:

```ts
const primaryVectorResults = await ctx.vectorSearch(
  "contentEmbeddings",
  "by_embedding",
  {
    vector: embedding,
    limit: RELEVANT_CONTENT_VECTOR_LIMIT,
    filter: (q) =>
      args.kind
        ? q.eq("userSourceKey", buildEmbeddingUserSourceKey(args.profileOwnerId, getNavigableContentSource(args.kind).sourceTable))
        : q.eq("userId", args.profileOwnerId),
  },
);
```

Non-navigable rows are dropped later at lines 125-130 via
`getNavigableContentSourceByTable(chunk.sourceTable) → null → continue`,
but only AFTER they've consumed slots in the 16-result window. For a
profile with bio entries (work history phrasing like "engineer at X
from 2022") and contact rows (an email that pattern-matches the
query) that score high for a query, those non-navigable chunks can
starve published article/post candidates that score just below the
cutoff. Pre-existing for `bioEntries`; PR #91 widens the blast
radius by adding a second non-navigable source.

The single-`vectorSearch`-filter shape was sufficient before
non-navigable sources existed. It is the wrong shape now.

## Goal

After this ticket, `findRelevantPublishedContent` returns the same
navigable candidates regardless of how many non-navigable bio/contact
rows the same user owns. A user with 50 bio entries and 5 contact rows
plus 20 published articles can still surface the best-matching article
for a relevant query.

## Scope

- Change the vector-search filter (or the search shape) at
  `packages/convex/convex/chat/relevantContent.ts:60-90` so that
  non-navigable source tables (`bioEntries`, `contactEntries`,
  future similar sources) do not consume slots in the candidate window
  when `args.kind` is undefined.
- Add a regression test in
  `packages/convex/convex/chat/__tests__/` that pins this behavior for
  both `bioEntries` and `contactEntries`.
- Update the inline comment at the `vectorSearch` call site to
  document why the filter must scope to navigable sources.

## Out of Scope

- Changing the `chunkText` budget or excerpt logic — pure
  candidate-window fix.
- The `args.kind`-specified branch (`q.eq("userSourceKey", ...)`)
  already scopes to one navigable table and is unaffected.
- The general RAG-context path (`embeddings.queries.findChunks` or
  similar) that the chat agent uses for system-prompt context.
  Non-navigable sources legitimately belong there.
- Reworking `RELEVANT_CONTENT_LEGACY_VECTOR_LIMIT` (the
  pre-`userSourceKey` legacy reach-around at line 81). That path is
  gated on `args.kind` being present, so it's already navigable-only.

## Approach

Three options, decide during impl based on the Convex `by_embedding`
vector index's filter capabilities:

(a) **Preferred — extend the vector index filter to navigable
sources.** Compose an `or(...)` of `q.eq("userSourceKey",
buildEmbeddingUserSourceKey(userId, t))` for each
`NAVIGABLE_CONTENT_SOURCES[].sourceTable`. This requires confirming
Convex vector search supports `or` over `userSourceKey` (currently
the index has a `userSourceKey` filterField). If it does, this is the
cleanest fix — one vector call, correctly bounded.

(b) **Fallback — two vector searches and merge.** One scoped to each
navigable `userSourceKey`, dedup + sort + slice to
`RELEVANT_CONTENT_VECTOR_LIMIT`. More vector reads but no index
changes.

(c) **Last resort — widen `RELEVANT_CONTENT_VECTOR_LIMIT`** to
something like 64 and accept the cost. Easiest fix but doesn't
address the underlying shape problem; non-navigable sources still
eat budget and the issue resurfaces as new non-navigable sources are
added.

Prefer (a). If the index doesn't support `or` over filterFields
(check `packages/convex/convex/embeddings/schema.ts` and Convex docs),
fall back to (b).

- **Effort:** Small (option a) | Medium (option b) | Trivial (option c)
- **Risk:** Low for (a)+(b) — behavior change is restricted to the
  candidate set, scored cutoff and final ranking stay the same.
  Medium for (c) — increases per-query embedding read cost without
  fixing the structural issue.

## Implementation Steps

1. Read the `by_embedding` index definition in
   `packages/convex/convex/embeddings/schema.ts` to confirm what
   filterFields it exposes (`userId`, `userSourceKey`, possibly
   `sourceTable`) and what operators its `filter` accepts (`eq`,
   `or`, etc.).
2. If `or` over `userSourceKey` is supported, change the no-`kind`
   branch at `relevantContent.ts:60-90` to filter to navigable
   `userSourceKey`s only. Source the navigable table list from
   `NAVIGABLE_CONTENT_SOURCES` in `content/sourceRegistry.ts` so new
   navigable sources are picked up automatically.
3. If not supported, run two scoped vector searches (one per
   navigable table), merge by `_id`, sort by `_score` desc, slice
   to `RELEVANT_CONTENT_VECTOR_LIMIT`.
4. Update the inline comment at the call site to document the
   navigable-source invariant and link to this ticket's reasoning
   (the post-filter at lines 125-130 stays as a defense-in-depth
   guard, not the sole filter).
5. Add `packages/convex/convex/chat/__tests__/relevant-content.test.ts`
   (or extend `helpers.test.ts` if `findRelevantPublishedContent` is
   already exercised there) that:
   - Seeds one user with: ~20 high-similarity `bioEntries` rows, ~5
     `contactEntries` rows, and one published `articles` row whose
     text contains the query terms but at a deliberately lower
     similarity than the bio rows (use the existing test embedder
     stub to deterministically set scores).
   - Calls `findRelevantPublishedContent` with no `kind`.
   - Asserts the article is returned in the candidate set.
   - Asserts no bio/contact rows appear in the candidate set.
6. Run `pnpm --filter=@feel-good/convex exec vitest run
   convex/chat/__tests__`. All tests should pass.
7. Verify the regression test would have caught the bug: revert the
   production fix locally, confirm the new test fails, restore the
   fix.

## Constraints

- The fix must cover both `bioEntries` AND `contactEntries`. Adding
  a per-source carveout is wrong — the rule is "navigable sources
  only in the published-content candidate pool", driven from
  `NAVIGABLE_CONTENT_SOURCES`.
- Do NOT remove the post-search navigability filter at
  `relevantContent.ts:125-130`. It stays as defense-in-depth; the
  vector-level filter is the perf fix.
- Do NOT widen this fix into the general RAG context retrieval
  path. Non-navigable sources belong in the chat agent's
  system-prompt context, just not in the navigable-content
  candidate pool surfaced by `findRelevantPublishedContent`.
- Per `.claude/rules/embeddings.md`, the cross-user isolation
  invariant must remain: every filter must still scope to
  `args.profileOwnerId`. Don't accidentally widen the filter to
  cross users while narrowing to navigable tables.

## Resources

- PR #91 — https://github.com/hpark0011/mirror/pull/91 (contact
  panel; codex P2 comment on
  `packages/convex/convex/content/sourceRegistry.ts:103`).
- `packages/convex/convex/chat/relevantContent.ts` — the call site.
- `packages/convex/convex/content/sourceRegistry.ts` —
  `NAVIGABLE_CONTENT_SOURCES` is the source of truth for which
  tables are navigable.
- `.claude/rules/embeddings.md` — cross-user isolation invariant
  that must be preserved.
- `.claude/rules/agent-parity.md` — Href-parity invariant; not
  affected by this fix but lives in the same area.
