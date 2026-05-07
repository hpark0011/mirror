---
id: FG_156
title: "Non-owner viewers never see Edit button on article detail toolbar"
date: 2026-05-06
type: fix
status: completed
priority: p1
description: "The isOwner UI gating in apps/mirror/features/articles/components/detail/article-detail-toolbar.tsx:27 has zero automated regression protection. A future refactor that misconfigures useIsProfileOwner or passes the wrong username could silently expose the Edit button to all viewers, breaking ownership semantics for the article-edit affordance introduced in merged PR #39."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "New Playwright spec at apps/mirror/e2e/article-edit-button.authenticated.spec.ts exists and is discovered by pnpm --filter=@feel-good/mirror test:e2e"
  - "The new spec authenticates as a user different from @test-user, navigates to /@test-user/articles/<publishedSlug>, and asserts await page.getByTestId('edit-article-btn').count() === 0"
  - "The new spec calls await waitForAuthReady(page) after page.goto per the authenticated-spec rule"
  - "Spec uses the non-owner fixture pattern from apps/mirror/e2e/clone-settings/non-owner-hidden-tab-and-404.spec.ts (verified by grep: grep -E 'non-owner|test-user' apps/mirror/e2e/article-edit-button.authenticated.spec.ts returns at least one match)"
  - "pnpm --filter=@feel-good/mirror build exits 0"
  - "pnpm --filter=@feel-good/mirror lint produces 0 errors"
owner_agent: "Playwright e2e author"
---

# Non-owner viewers never see Edit button on article detail toolbar

## Context

PR #39 (`feature-edit-article-button`, merged in `437d481b`) added the Edit button to `apps/mirror/features/articles/components/detail/article-detail-toolbar.tsx`. The relevant gating code:

```tsx
// apps/mirror/features/articles/components/detail/article-detail-toolbar.tsx:18-43
export function ArticleDetailToolbar({ username, slug }: ArticleDetailToolbarProps) {
  const isOwner = useIsProfileOwner();
  // ...
  {isOwner && (
    <Button asChild variant="primary" size="xs" className="w-12" data-testid="edit-article-btn">
      <Link href={buildChatAwareHref(`/@${username}/articles/${slug}/edit`)} scroll={false}>
        Edit
      </Link>
    </Button>
  )}
}
```

The `isOwner` gate is the sole boundary preventing non-author readers from seeing an "Edit" affordance on a public article URL. There is currently no Playwright coverage that asserts this gating holds. A future refactor of `useIsProfileOwner` (or a slip in how `username` is plumbed into the toolbar) could silently flip the gate without any test failure.

The pattern to mirror exists at `apps/mirror/e2e/clone-settings/non-owner-hidden-tab-and-404.spec.ts` — it authenticates as a non-owner and asserts an owner-only affordance is absent.

## Goal

A new Playwright spec proves the Edit button is invisible to anyone other than the article's author, locking in PR #39's ownership invariant against future regressions.

## Scope

- Create `apps/mirror/e2e/article-edit-button.authenticated.spec.ts`.
- Test case: visit `/@test-user/articles/<publishedSlug>` while authenticated as a different user (or via the existing non-owner fixture), then assert `getByTestId("edit-article-btn")` count is 0 and the back button still renders.
- Reuse the article fixtures helper pattern (or import) from the existing `apps/mirror/e2e/workspace-back-button.authenticated.spec.ts` so the published article exists.

## Out of Scope

- Adding any positive-path assertion that the owner sees the Edit button — that lives in a separate ticket if needed.
- Refactoring `useIsProfileOwner` itself.
- Adding test coverage for the post-detail toolbar (no equivalent edit affordance there at this time).
- Server-side authorization tests (the gate is currently UI-only; if the `/edit` route also needs server gating, that is its own ticket).

## Approach

Mirror the non-owner fixture shape used by `apps/mirror/e2e/clone-settings/non-owner-hidden-tab-and-404.spec.ts`. Reuse `ensureTestArticleFixtures` to guarantee the published article exists. Authenticate as the non-owner, navigate to the article detail URL, await `waitForAuthReady`, then assert:

```ts
const editBtn = page.getByTestId("edit-article-btn");
await expect(editBtn).toHaveCount(0);
```

The back button should still be visible — verifying the toolbar rendered at all rules out a false negative where the page never loaded.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Read `apps/mirror/e2e/clone-settings/non-owner-hidden-tab-and-40e.spec.ts` to confirm the non-owner fixture/auth pattern (test fixture name, viewport, etc.).
2. Read `apps/mirror/e2e/workspace-back-button.authenticated.spec.ts` and copy the `ensureTestArticleFixtures` helper (or extract it to a shared `e2e/lib/` helper if both specs would benefit — only if trivial).
3. Create `apps/mirror/e2e/article-edit-button.authenticated.spec.ts` with one test: "non-owner viewers cannot see the Edit button on article detail".
4. In the test: get the published slug via `ensureTestArticleFixtures()`, authenticate as a non-owner, `page.goto(/@test-user/articles/<publishedSlug>)`, `await waitForAuthReady(page)`, assert `getByTestId("workspace-back-button")` is visible (page rendered), then assert `getByTestId("edit-article-btn")` has count 0.
5. Run `pnpm --filter=@feel-good/mirror test:e2e -- article-edit-button` and confirm the spec passes against the current build.
6. Run `pnpm --filter=@feel-good/mirror build && pnpm --filter=@feel-good/mirror lint` and confirm both exit 0.

## Constraints

- Spec filename MUST end in `.authenticated.spec.ts` so it routes through the authenticated fixture per project convention.
- Do not modify production code (`article-detail-toolbar.tsx`, `useIsProfileOwner`, etc.) — this is a test-only ticket.
- Use `getByTestId("edit-article-btn")` — that test id is the public contract; do not assert against text content.

## Resources

- File under test: `apps/mirror/features/articles/components/detail/article-detail-toolbar.tsx:18-45`
- Pattern to mirror: `apps/mirror/e2e/clone-settings/non-owner-hidden-tab-and-404.spec.ts`
- Fixture helper to reuse: `apps/mirror/e2e/workspace-back-button.authenticated.spec.ts:9-27` (`ensureTestArticleFixtures`)
- Originating PR: `#39 feature-edit-article-button` (merged at commit `437d481b`)
- Convention: `.claude/rules/verification.md` — Tier 5 (e2e for new feature gating)
