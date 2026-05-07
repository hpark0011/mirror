import { expect, test, type Page } from "@playwright/test";

/**
 * Featured-card click dispatcher parity.
 *
 * Pins the modifier-key early-return in `FeaturedArticleCard.handleClick`
 * (`apps/mirror/features/articles/components/list/article-list-featured-card.tsx`).
 * The handler intercepts plain left-click and routes through
 * `useCloneActions().navigateToContent` (so the chat-aware suffix and
 * `scroll: false` invariants funnel through the same dispatcher every other
 * surface uses); on `metaKey/ctrlKey/shiftKey/altKey/button !== 0` it must
 * surrender to the default `<Link>` behaviour so cmd-click-to-open-in-new-tab
 * keeps working.
 *
 * Mirrors `profile-tabs-dispatcher.spec.ts:100-131` ("cmd-click on a tab opens
 * a new tab"). Without this, removing or inverting the guard would silently
 * break opening a featured article in a new tab.
 *
 * Pre-conditions: rick-rubin fixture user has at least one published article
 * with a `publishedAt` timestamp (the featured slot only surfaces published
 * rows — see `getLatestPublishedArticles`). The two most-recent articles in
 * the seed (`nature-and-the-creative-process`, `simplicity-as-a-superpower`)
 * fill the featured slots.
 */

const username = "rick-rubin";
// Most-recently published article in the seed (`daysAgo: 7`). It always
// occupies the first featured slot. Matches `SEED_ARTICLES[2]` in
// `packages/convex/convex/seed/data.ts`.
const featuredSlug = "nature-and-the-creative-process";

async function gotoArticles(page: Page, query = "") {
  await page.setViewportSize({ width: 1440, height: 960 });
  const url = `/@${username}/articles${query ? `?${query}` : ""}`;
  await page.goto(url, { waitUntil: "domcontentloaded" });
}

test.describe("Article featured-card dispatcher (FeaturedArticleCard.handleClick)", () => {
  test("plain left-click navigates within the same tab to the article detail URL", async ({
    page,
    context,
  }) => {
    // Pins the dispatcher branch — `useCloneActions().navigateToContent`
    // pushes the chat-aware href onto the same tab. A regression that
    // surrendered to the `<Link>`'s default would still navigate, but
    // would also bypass the dispatcher's invariants (chat-aware suffix +
    // `scroll: false`). The stronger guarantee is "no new tab opens".
    await gotoArticles(page, "chat=1");

    const featuredCard = page
      .getByTestId("article-list-featured-card")
      .first();
    await expect(featuredCard).toBeVisible({ timeout: 10_000 });

    const initialPageCount = context.pages().length;

    await featuredCard.click();

    await expect(page).toHaveURL(
      new RegExp(`/@${username}/articles/${featuredSlug}(?:\\?|$)`),
      { timeout: 10_000 },
    );
    // Chat-aware suffix preserved by the dispatcher's
    // `buildChatAwareHref` call inside `FeaturedArticleCard`.
    expect(page.url()).toMatch(/[?&]chat=1\b/);

    // No new tab was opened — left-click stayed within the active tab.
    expect(context.pages().length).toBe(initialPageCount);
  });

  test("cmd-click on a featured card opens a new tab and leaves the original URL unchanged", async ({
    page,
    context,
  }) => {
    // Pins the modifier-key early-return. The handler must NOT call
    // `event.preventDefault()` when `metaKey` is held, so the browser's
    // default `<Link>` behaviour takes over and opens a new tab. A
    // regression here (e.g. moving `event.preventDefault()` above the
    // modifier guard) would silently break cmd-click in production.
    await gotoArticles(page, "chat=1");

    const featuredCard = page
      .getByTestId("article-list-featured-card")
      .first();
    await expect(featuredCard).toBeVisible({ timeout: 10_000 });

    const [newPage] = await Promise.all([
      context.waitForEvent("page"),
      featuredCard.click({ modifiers: ["Meta"] }),
    ]);

    // Newly opened tabs start at `about:blank` and only commit the real
    // URL after the navigation lands. Wait for the article URL pattern
    // before asserting on `newPage.url()` instead of relying on
    // `domcontentloaded`, which can fire while the tab is still on
    // `about:blank`.
    await newPage.waitForURL(
      new RegExp(`/@${username}/articles/${featuredSlug}(?:\\?|$)`),
      { timeout: 10_000 },
    );
    expect(newPage.url()).toMatch(
      new RegExp(`/@${username}/articles/${featuredSlug}(?:\\?|$)`),
    );
    // The opened tab must preserve `chat=1` too — the dispatcher's
    // early-return on modifier keys surrenders to the `<Link href>`,
    // so a regression in `href={buildChatAwareHref(...)}` would only
    // show up on the new tab, not the original.
    expect(newPage.url()).toMatch(/[?&]chat=1\b/);

    // Original tab still on /@rick-rubin/articles with the chat suffix
    // intact. The early-return must not navigate the active tab.
    expect(page.url()).toMatch(new RegExp(`/@${username}/articles(?:\\?|$)`));
    expect(page.url()).not.toMatch(
      new RegExp(`/@${username}/articles/${featuredSlug}`),
    );
    expect(page.url()).toMatch(/[?&]chat=1\b/);

    await newPage.close();
  });
});
