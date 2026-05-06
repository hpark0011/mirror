---
id: FG_159
title: "Back button preserves ?chat=1 from article and post detail toolbars"
date: 2026-05-06
type: improvement
status: to-do
priority: p2
description: "Existing tests in apps/mirror/e2e/workspace-back-button.authenticated.spec.ts:46-48,69-72 assert href shape /@username/articles(?:\\?|$) which matches with or without the chat query string. The unified back button runs through buildChatAwareHref in article-detail-toolbar.tsx:25 and post-detail-toolbar.tsx:22. A regression that drops buildChatAwareHref would not be caught. Add assertions that confirm chat=1 is preserved when present in the URL."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "apps/mirror/e2e/workspace-back-button.authenticated.spec.ts contains a new test variant (or extension of existing tests) that visits the article detail page with ?chat=1 in the URL and asserts the workspace-back-button href attribute contains chat=1"
  - "Same assertion exists for the post detail toolbar variant"
  - "grep -n 'chat=1' apps/mirror/e2e/workspace-back-button.authenticated.spec.ts returns at least 2 matches (one per detail toolbar)"
  - "pnpm --filter=@feel-good/mirror test:e2e -- workspace-back-button passes against the current build"
  - "pnpm --filter=@feel-good/mirror build exits 0"
  - "pnpm --filter=@feel-good/mirror lint produces 0 errors"
owner_agent: "Playwright e2e author"
---

# Back button preserves ?chat=1 from article and post detail toolbars

## Context

The unified `WorkspaceBackButton` runs its `href` through `buildChatAwareHref(...)` at two call sites:

- `apps/mirror/features/articles/components/detail/article-detail-toolbar.tsx:25` — `href={buildChatAwareHref(getContentHref(username, "articles"))}`
- `apps/mirror/features/posts/components/detail/post-detail-toolbar.tsx:22` — same shape for `"posts"`

`buildChatAwareHref` (from `apps/mirror/hooks/use-chat-search-params.ts`) preserves the `chat=1` query parameter so a reader who arrived via the chat-side panel returns to a list URL that keeps the chat panel open.

The current e2e assertions in `apps/mirror/e2e/workspace-back-button.authenticated.spec.ts:46-48,69-72` use a forgiving regex:

```ts
await expect(back).toHaveAttribute(
  "href",
  new RegExp(`/@${username}/articles(?:\\?|$)`),
);
```

This regex matches `/@test-user/articles`, `/@test-user/articles?chat=1`, and `/@test-user/articles?` equivalently. A regression that drops the `buildChatAwareHref` wrapper (so the back button always resolves to the bare `/articles` URL) would pass this assertion despite breaking chat-aware navigation.

## Goal

A new test variant (or extension of the existing test) navigates to a detail URL with `?chat=1`, then asserts the back button's `href` actively contains `chat=1`. Coverage exists for both article and post detail toolbars.

## Scope

- Add a new test, or two new tests, in `apps/mirror/e2e/workspace-back-button.authenticated.spec.ts`:
  1. "article detail back button preserves ?chat=1" — visit `/@test-user/articles/<publishedSlug>?chat=1`, assert back button `href` contains `chat=1`.
  2. "post detail back button preserves ?chat=1" — analogous for posts.
- Use a stricter regex or `toContainText`/`toHaveAttribute` substring assertion: `/chat=1/`.

## Out of Scope

- Changing `buildChatAwareHref` itself.
- Adding equivalent tests for the editor (action) mode — action mode does not render `href`.
- Adding tests for any other query parameter beyond `chat=1`.
- Stress-testing multi-parameter URL preservation (e.g., `?chat=1&filter=published`).

## Approach

Two flat assertions, one per detail toolbar. Reuse the `ensureTestArticleFixtures()` helper for the article case; for the post case, follow the existing list-click navigation pattern OR (preferred) introduce a `ensureTestPostFixtures()` call (see also FG_162) so the test navigates directly to a known post URL.

```ts
test("article detail back button preserves ?chat=1", async ({ authenticatedPage: page }) => {
  const { publishedSlug } = await ensureTestArticleFixtures();
  await page.goto(`/@${username}/articles/${publishedSlug}?chat=1`, {
    waitUntil: "domcontentloaded",
  });
  await waitForAuthReady(page);
  const back = page.getByTestId("workspace-back-button");
  await expect(back).toBeVisible({ timeout: 10_000 });
  await expect(back).toHaveAttribute("href", /chat=1/);
});
```

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Read `apps/mirror/hooks/use-chat-search-params.ts` to confirm `buildChatAwareHref` semantics — specifically that visiting a URL with `?chat=1` causes the link to include `chat=1`.
2. Read `apps/mirror/e2e/workspace-back-button.authenticated.spec.ts` end-to-end and locate the two existing detail tests at lines 30-49 and 51-73.
3. Add a third test for the article case: navigate to `?chat=1`, assert back button `href` matches `/chat=1/`.
4. Add a fourth test for the post case: same shape. If post fixture coverage is fragile, this ticket's work depends on FG_162 (post fixture stabilization) — call it out in the PR description.
5. Run `pnpm --filter=@feel-good/mirror test:e2e -- workspace-back-button` — confirm 4 (or 5) tests pass.
6. Run `pnpm --filter=@feel-good/mirror build && pnpm --filter=@feel-good/mirror lint` — both exit 0.

## Constraints

- Do not weaken the existing assertions — the new tests are additive.
- Do not assert on full URL equality — substring `/chat=1/` is more resilient.
- The new tests live in the same spec file (do not split into a new file).

## Resources

- Spec to extend: `apps/mirror/e2e/workspace-back-button.authenticated.spec.ts`
- Article toolbar consumer: `apps/mirror/features/articles/components/detail/article-detail-toolbar.tsx:20-26`
- Post toolbar consumer: `apps/mirror/features/posts/components/detail/post-detail-toolbar.tsx:20-26` (verify line numbers)
- Hook source: `apps/mirror/hooks/use-chat-search-params.ts`
- Related ticket: `FG_162` (post fixture stabilization) if the post-side test depends on it
