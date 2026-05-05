---
id: FG_131
title: "resolveBySlug cross-user test pins index scoping with same-slug collision case"
date: 2026-05-05
type: improvement
status: to-do
priority: p2
description: "The cross-user isolation test for resolveBySlug inserts the slug only for userB and then queries as userA. A regression that dropped the userId clause from the by_userId_and_slug index would still pass — userA has no row, so .unique() returns null regardless. Adding a dual-insert case (same slug for both userA and userB, both published) pins the compound-index scoping at the strongest shape: each user must get their own row when the slug collides."
dependencies: []
parent_plan_id: docs/plans/2026-05-04-feat-agent-ui-parity-plan.md
acceptance_criteria:
  - "A new it() case in `tools.test.ts` under the `chat/toolQueries.resolveBySlug` describe block inserts the same slug 'shared-slug' for two distinct users (both with status: 'published')"
  - "The test asserts userA querying 'shared-slug' returns userA's row (not userB's): `result.username === 'user_a_collision'` AND `result.title` matches userA's title"
  - "The test asserts userB querying the same slug returns userB's row: `result.username === 'user_b_collision'` AND `result.title` matches userB's title"
  - "Regression-proof: temporarily change the resolveBySlug query to `withIndex('by_userId_and_slug', q => q.eq('slug', slug))` (drop the userId clause), run the test, confirm it fails; revert"
  - "`pnpm --filter=@feel-good/convex test:unit packages/convex/convex/chat/__tests__/tools.test.ts` passes"
owner_agent: "Convex chat backend developer"
---

# resolveBySlug cross-user test pins index scoping with same-slug collision case

## Context

Code review on `feature-agent-parity-architecture` (tests reviewer, P2 0.75) found a coverage gap in the cross-user `resolveBySlug` test.

The current test at `packages/convex/convex/chat/__tests__/tools.test.ts:270-315` proves: when userB owns slug X and userA queries slug X, userA gets null. It uses a positive control (userB querying the same slug returns the row) to prove the row was actually inserted, which is good practice.

But the negative path is shaped such that a regression in the index could still pass. Specifically: if someone refactored `resolveBySlug` to drop the `userId` clause and query only by `slug`, userA's query would still return null in the existing test — because the slug exists for userB, but userA has no row at all and `.unique()` would return either userB's row OR null depending on how the change is shaped.

In particular, `.unique()` throws when it sees more than one row. With only userB's row in the table, dropping the userId clause makes userA's query return userB's row (a real cross-user leak). The current test's positive control catches that case — but only because there's exactly one row total. The dual-insert shape catches it under a wider class of regressions:

- Same slug, two users, both published.
- Each user queries that slug.
- Each must get their own row.
- A wrong index would either throw (`.unique()` on two rows) or leak (returning the first match).

This is the strongest possible test for the compound-index scoping invariant.

## Goal

The `by_userId_and_slug` compound-index scoping is verified under the slug-collision condition that maximally exercises the index — same slug exists for both users, each query gets the user's own row, and a regression in either the index definition or the query handler fails the test loudly.

## Scope

- Add one new it() case in `tools.test.ts` under the existing `chat/toolQueries.resolveBySlug` describe block.
- Insert two articles with `slug: "shared-slug"`, `status: "published"`, distinct `userId` values, distinct `title` values.
- Query as each user; assert each gets the matching row (username, title).
- Optional: also assert the `href` differs between the two users (`/@user_a/articles/shared-slug` vs `/@user_b/articles/shared-slug`).

## Out of Scope

- Adding the same shape for `posts` (already covered indirectly by the `scopes posts independently from articles (same slug across kinds)` test at lines 330-373 — that test uses one user and two kinds; a posts-side cross-user-collision test would be additive but is lower priority).
- Adding the shape to `queryLatestPublished` — that query has a different invariant (returns the user's most recent published row, regardless of slug).
- Changing the existing `SECURITY: returns null when the slug is owned by a DIFFERENT user` test — keep it; this new case is additive.

## Approach

Mirror the existing test's pattern: insert via `t.run`, query via `t.query`. Use distinct, descriptive titles so the assertion clearly proves which row came back:

```ts
it("scopes resolveBySlug to userId when the same slug exists for multiple users", async () => {
  const t = makeT();
  const userA = await insertOwner(t, "user_a_collision");
  const userB = await insertOwner(t, "user_b_collision");

  await t.run(async (ctx) =>
    ctx.db.insert("articles", {
      userId: userA,
      slug: "shared-slug",
      title: "User A's article",
      category: "blog",
      body: { type: "doc", content: [] },
      status: "published",
      publishedAt: 1000,
      createdAt: 1000,
    }),
  );
  await t.run(async (ctx) =>
    ctx.db.insert("articles", {
      userId: userB,
      slug: "shared-slug",
      title: "User B's article",
      category: "blog",
      body: { type: "doc", content: [] },
      status: "published",
      publishedAt: 2000,
      createdAt: 2000,
    }),
  );

  const aResult = await t.query(internal.chat.toolQueries.resolveBySlug, {
    userId: userA, kind: "articles", slug: "shared-slug",
  });
  expect(aResult).not.toBeNull();
  expect(aResult!.username).toBe("user_a_collision");
  expect(aResult!.title).toBe("User A's article");

  const bResult = await t.query(internal.chat.toolQueries.resolveBySlug, {
    userId: userB, kind: "articles", slug: "shared-slug",
  });
  expect(bResult).not.toBeNull();
  expect(bResult!.username).toBe("user_b_collision");
  expect(bResult!.title).toBe("User B's article");
});
```

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Open `packages/convex/convex/chat/__tests__/tools.test.ts`.
2. Inside the `chat/toolQueries.resolveBySlug` describe block (after line 373), add the new it() case as shown in Approach.
3. Run `pnpm --filter=@feel-good/convex test:unit packages/convex/convex/chat/__tests__/tools.test.ts` and confirm the new case passes.
4. Regression-proof (optional but recommended): temporarily edit `toolQueries.ts:142-144` to drop the `userId` clause, re-run the test, confirm it fails; revert.

## Constraints

- Do not modify the production `resolveBySlug` query in this ticket.
- Do not modify the existing `SECURITY: returns null when the slug is owned by a DIFFERENT user` test.
- Use the existing `insertOwner` helper to keep the test's data setup consistent with peers.

## Resources

- `.claude/rules/agent-parity.md` § Cross-user isolation invariant
- Code review report from `/review-code` on `feature-agent-parity-architecture` (2026-05-05) — P2 #5
- Existing peer test: `tools.test.ts:270-315` ("returns null when the slug is owned by a DIFFERENT user")
- Existing peer test: `tools.test.ts:330-373` ("scopes posts independently from articles")
