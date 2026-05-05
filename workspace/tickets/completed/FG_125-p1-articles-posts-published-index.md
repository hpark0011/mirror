---
id: FG_125
title: "Articles and posts published-status reads scale via a by_userId_and_status index"
date: 2026-05-05
type: perf
status: completed
priority: p1
description: "Two newly added Convex read sites — loadStreamingContext's inventory presence checks and the queryLatestPublished tool query — use `.withIndex(by_userId).filter(status === 'published')` to find the user's published rows. Convex applies `.filter()` post-index, so a user with N drafts before any published row scans N rows on every chat turn. Both sites violate the project's `.claude/rules/convex.md` rule against `.filter()` in queries. Adding a compound `by_userId_and_status` index to articles and posts and switching the call sites bounds the scan to published rows only."
dependencies: []
parent_plan_id: docs/plans/2026-05-04-feat-agent-ui-parity-plan.md
acceptance_criteria:
  - "`grep -n 'by_userId_and_status' packages/convex/convex/articles/schema.ts packages/convex/convex/posts/schema.ts` shows one .index() entry per file"
  - "`grep -n '\\.filter(' packages/convex/convex/chat/helpers.ts packages/convex/convex/chat/toolQueries.ts` returns no matches inside `loadStreamingContext` or `queryLatestPublished`/`resolveBySlug`"
  - "`pnpm --filter=@feel-good/convex test:unit packages/convex/convex/chat/__tests__/tools.test.ts packages/convex/convex/chat/__tests__/helpers.test.ts` passes (existing tests still green)"
  - "`pnpm --filter=@feel-good/convex exec convex codegen` runs cleanly and `_generated/dataModel.d.ts` exposes the new index in `articles` and `posts` table types"
  - "A new Vitest case inserts 50 drafts + 1 published article for a user and asserts queryLatestPublished returns in <50ms (or asserts via test profiling that fewer than 5 documents are read for the published lookup)"
  - "`pnpm build --filter=@feel-good/mirror` and `pnpm lint --filter=@feel-good/mirror` both pass"
owner_agent: "Convex backend developer"
---

# Articles and posts published-status reads scale via a by_userId_and_status index

## Context

Multi-reviewer code review on `feature-agent-parity-architecture` flagged this as the diff's highest-impact concrete bug. Three reviewers (convention, correctness, performance) converged on the same lines:

- `packages/convex/convex/chat/helpers.ts:242-251` — `loadStreamingContext` runs three independent presence-check queries on every chat turn. Two of them use:
  ```ts
  await ctx.db
    .query("articles")
    .withIndex("by_userId", (q) => q.eq("userId", profileOwnerId))
    .filter((q) => q.eq(q.field("status"), "published"))
    .take(1);
  ```
  and the same shape for `posts`. Convex applies `.filter()` after the index scan, so a user with N drafts (and 0 or few published rows) reads N documents per call.
- `packages/convex/convex/chat/toolQueries.ts:98-112` — `queryLatestPublished` opens a descending iterator on `by_userId` and skips drafts:
  ```ts
  for await (const row of iter) {
    if (row.status !== "published") continue;
    return { ... };
  }
  ```
  Worst case: a user with N drafts and 0 published rows reads all N.

The current article/post schemas (`packages/convex/convex/articles/schema.ts:14-15`, `packages/convex/convex/posts/schema.ts:10-11`) define only `by_userId` and `by_userId_and_slug` — there is no `by_userId_and_status` to query against.

`.claude/rules/convex.md` § Query guidelines explicitly forbids `.filter()` in queries: "Do NOT use `filter` in queries. Instead, define an index in the schema and use `withIndex` instead."

## Goal

Both call sites pin published rows via a compound index, eliminating draft-row scans on the chat hot path and bringing the code into compliance with the convex.md rule.

## Scope

- Add `.index("by_userId_and_status", ["userId", "status"])` to `articlesTable` in `packages/convex/convex/articles/schema.ts`.
- Add the same index to `postsTable` in `packages/convex/convex/posts/schema.ts`.
- Rewrite the two `loadStreamingContext` presence checks in `packages/convex/convex/chat/helpers.ts:242-251` to use `withIndex("by_userId_and_status", q => q.eq("userId", profileOwnerId).eq("status", "published")).take(1)` (no `.filter()`).
- Rewrite `queryLatestPublished` in `packages/convex/convex/chat/toolQueries.ts:79-113` to use the same compound index (`.eq("userId", ...).eq("status", "published")`), keeping the descending order, replacing the `for await` walk with `.first()` / `.take(1)`.
- Run codegen so `_generated/api.d.ts` reflects the new index.
- Add a Vitest case in `chat/__tests__/tools.test.ts` that inserts many drafts + one published row and confirms the query no longer scans the drafts (assertion shape: total documents read or ms latency below a sane bound).

## Out of Scope

- The third presence-check query in `loadStreamingContext` reads `bioEntries` without a status filter — that one is fine and is not part of this ticket.
- Parallelizing the three serial awaits with `Promise.all` is a separate P2 ticket (orthogonal to the index fix).
- The bio entries table has no draft lifecycle and does not need a status-aware index.
- Renaming/restructuring the existing `by_userId_and_slug` index.

## Approach

Convex compound indexes require equality clauses in declaration order. Both new sites are `userId === X && status === "published"`, so a `["userId", "status"]` index covers them exactly. For `queryLatestPublished` we still want the most recent published row, so the rewrite is `.withIndex("by_userId_and_status", q => q.eq("userId", userId).eq("status", "published")).order("desc").first()` — drop the `for await` skip-loop entirely.

The schema change is non-breaking: adding an index does not require a data migration. Convex builds the index in the background after deploy.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Edit `packages/convex/convex/articles/schema.ts`: append `.index("by_userId_and_status", ["userId", "status"])` to the `articlesTable` chain.
2. Edit `packages/convex/convex/posts/schema.ts`: append the same index to `postsTable`.
3. Run `pnpm --filter=@feel-good/convex exec convex codegen` to regenerate `_generated/dataModel.d.ts` and `_generated/api.d.ts`.
4. Edit `packages/convex/convex/chat/helpers.ts:242-251`: replace both `articles` and `posts` queries with `withIndex("by_userId_and_status", q => q.eq("userId", profileOwnerId).eq("status", "published")).take(1)`.
5. Edit `packages/convex/convex/chat/toolQueries.ts:79-113`: replace the iterator walk with `.withIndex("by_userId_and_status", q => q.eq("userId", userId).eq("status", "published")).order("desc").first()` and adjust the return shape (the row already has `status === "published"`, so the skip-check is gone).
6. Add a Vitest case to `packages/convex/convex/chat/__tests__/tools.test.ts` under the `queryLatestPublished` describe: insert ~30 drafts + 1 published article for one user, assert the query returns the published row and that no draft slugs appear in any returned shape.
7. Run `pnpm --filter=@feel-good/convex test:unit` and `pnpm build --filter=@feel-good/mirror` + `pnpm lint --filter=@feel-good/mirror`.

## Constraints

- Do not introduce a separate `by_userId_and_publishedAt` index in this ticket. The `_creationTime` ordering note in the existing comment at `toolQueries.ts:87-94` is a known caveat; if `publishedAt`-aware ordering becomes a requirement, file a follow-up.
- Keep the query functions' validators (`latestPublishedReturnValidator`, `resolveBySlugReturnValidator`) unchanged — only the index access pattern changes.
- Do not delete the existing `by_userId` index — other call sites in `articles/queries.ts` and `posts/queries.ts` use it.

## Resources

- `.claude/rules/convex.md` § Query guidelines (the rule being violated)
- `.claude/rules/agent-parity.md` (the rule the parity work installs)
- Code review report from `/review-code` on `feature-agent-parity-architecture` (2026-05-05) — P1 cluster 1 + 2
- Convex docs on compound indexes: https://docs.convex.dev/database/indexes/
