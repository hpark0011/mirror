---
id: FG_162
title: "Post-detail back-button test uses ensureTestPostFixtures and direct nav"
date: 2026-05-06
type: improvement
status: to-do
priority: p2
description: "The post-detail back-button test at apps/mirror/e2e/workspace-back-button.authenticated.spec.ts:51-73 navigates to /@test-user/posts and clicks article a[href*='/posts/'] first(). It does not call ensureTestPostFixtures(). If the test account has zero published posts, Playwright times out with an unrelated locator error rather than a clear missing-fixture diagnostic. Mirror the pattern in apps/mirror/e2e/post-publish-toggle.authenticated.spec.ts:19 by seeding fixtures and navigating directly to a known post URL."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "apps/mirror/e2e/workspace-back-button.authenticated.spec.ts:51-73 calls ensureTestPostFixtures() before page.goto"
  - "The test navigates directly to /@test-user/posts/<knownSlug> rather than clicking the first list item"
  - "grep -nE 'ensureTestPostFixtures' apps/mirror/e2e/workspace-back-button.authenticated.spec.ts returns at least one match"
  - "grep -E 'article a\\[href\\*=.\\\\/posts\\\\/.\\]' apps/mirror/e2e/workspace-back-button.authenticated.spec.ts returns 0 matches (the brittle list-click selector is gone)"
  - "pnpm --filter=@feel-good/mirror test:e2e -- workspace-back-button passes"
  - "pnpm --filter=@feel-good/mirror build exits 0"
  - "pnpm --filter=@feel-good/mirror lint produces 0 errors"
owner_agent: "Playwright e2e fixture-discipline maintainer"
---

# Post-detail back-button test uses ensureTestPostFixtures and direct nav

## Context

The post-detail back-button test currently relies on the test account already having at least one published post:

```ts
// apps/mirror/e2e/workspace-back-button.authenticated.spec.ts:51-73
test("post detail toolbar renders link mode with href to /posts", async ({
  authenticatedPage: page,
}) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto(`/@${username}/posts`, { waitUntil: "domcontentloaded" });
  await waitForAuthReady(page);

  // Click the first post in the list to enter detail.
  const firstPostLink = page
    .locator("article a[href*='/posts/']")
    .first();
  await firstPostLink.click();
  // ...
});
```

There is no `ensureTestPostFixtures()` call. If the test fixture state ever drifts (no posts seeded, posts deleted by a sibling test, fixture purge between runs), the locator times out with a generic Playwright error like "expected to find element but found 0" rather than a clear "no fixture posts exist" diagnostic. This pattern is exactly the brittleness `ensureTestPostFixtures()` was created to eliminate — see `apps/mirror/e2e/post-publish-toggle.authenticated.spec.ts:19`.

Additionally, clicking the first list item is racy in the presence of optimistic-update animations, list re-sorts, or pagination. Direct navigation to a known fixture URL is faster, more deterministic, and easier to debug.

## Goal

The post-detail back-button test seeds its fixtures explicitly via `ensureTestPostFixtures()` and navigates directly to the published post URL, eliminating the list-click brittleness.

## Scope

- Import `ensureTestPostFixtures` (or define a local helper mirroring `ensureTestArticleFixtures` in the same file) at the top of `apps/mirror/e2e/workspace-back-button.authenticated.spec.ts`.
- Inside the post-detail test:
  1. Call `ensureTestPostFixtures()` and capture the published-post slug.
  2. `page.goto(\`/@\${username}/posts/\${publishedSlug}\`, ...)` directly.
  3. Drop the `article a[href*='/posts/'] first().click()` flow.
- Keep the same assertions about the back button (visible, role link, accessible name "Back", href shape).

## Out of Scope

- Refactoring the article-detail test (already uses `ensureTestArticleFixtures`).
- Centralizing the fixture helpers into a shared `e2e/lib/fixtures.ts` (separate ticket if desirable).
- Adding any new assertions beyond those already in the test.
- Testing fixture-creation idempotency or cleanup.

## Approach

Read `apps/mirror/e2e/post-publish-toggle.authenticated.spec.ts:19` to confirm the exact import path and shape of `ensureTestPostFixtures`. If the helper is colocated in a single spec rather than exported from a shared module, mirror its structure inline in `workspace-back-button.authenticated.spec.ts` (similar to how `ensureTestArticleFixtures` is defined locally at lines 9-27).

The Convex test endpoint pattern (looking at `ensureTestArticleFixtures`) is:

```
POST ${convexSiteUrl}/test/ensure-post-fixtures
body: { email: testEmail }
returns: { publishedSlug: string, ... }
```

Verify the endpoint name (`ensure-post-fixtures` vs `ensure-test-post-fixtures`) by reading the Convex http handler under `packages/convex/convex/`.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Read `apps/mirror/e2e/post-publish-toggle.authenticated.spec.ts:1-30` and confirm the exact `ensureTestPostFixtures` shape (locally defined vs imported, fields returned).
2. Locate the corresponding Convex endpoint under `packages/convex/convex/` to confirm the route path and response schema (`grep -rn "ensure-post-fixtures\|ensure-test-post-fixtures" packages/convex/convex/`).
3. Add either an `ensureTestPostFixtures` local helper to `apps/mirror/e2e/workspace-back-button.authenticated.spec.ts` (mirror the article helper at lines 9-27) OR import from a shared module if one already exists.
4. Refactor the post-detail test (`apps/mirror/e2e/workspace-back-button.authenticated.spec.ts:51-73`) to call `ensureTestPostFixtures()` first, then `page.goto` directly to the published post URL, then `await waitForAuthReady(page)`, then assert the back button.
5. Run `pnpm --filter=@feel-good/mirror test:e2e -- workspace-back-button` and confirm green.
6. Run `pnpm --filter=@feel-good/mirror build && pnpm --filter=@feel-good/mirror lint` — both exit 0.

## Constraints

- Do not change the back-button assertions (visibility, role, accessible name, href regex) — only the fixture/navigation strategy.
- The local helper, if added, must follow the same error-handling shape as `ensureTestArticleFixtures` (throws on non-OK status with the response text in the message).
- If `ensureTestPostFixtures` is already a shared exported helper somewhere under `apps/mirror/e2e/lib/`, prefer importing over redefining.

## Resources

- Test to refactor: `apps/mirror/e2e/workspace-back-button.authenticated.spec.ts:51-73`
- Pattern source: `apps/mirror/e2e/post-publish-toggle.authenticated.spec.ts:19`
- Local helper template: `apps/mirror/e2e/workspace-back-button.authenticated.spec.ts:9-27` (`ensureTestArticleFixtures`)
- Convex endpoints: `packages/convex/convex/` — search for `ensure-post` and `ensure-article`
- Related ticket: `FG_159` (chat-aware href) may also benefit from this fixture if its post-side variant is added
