import { expect, test } from "@playwright/test";

const username = "rick-rubin";
const articleSlug = "the-art-of-listening";
const articleTitle = "The Art of Listening";
const articleExcerpt =
  "Most people think producing music is about adding things.";
const postTitle = "Listening Before Speaking";
const postCategory = "Attention";
const newestPostTitle = "The Source Is Everywhere";
const oldestPostTitle = "Listening Before Speaking";
const collaborationPostTitle = "Make the Room Safe";
const filteredWeekPostTitle = "Doubt as Compass";
const creativityArticleTitle = "Simplicity as a Superpower";

function isPrefetchRequest(headers: Record<string, string | undefined>) {
  return (
    headers["next-router-prefetch"] !== undefined ||
    headers.purpose === "prefetch"
  );
}

test.describe("Article navigation", () => {
  test("keeps the desktop profile root hidden until artifacts are opened", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`/@${username}`);

    await expect(
      page,
    ).toHaveURL(new RegExp(`/@${username}(\\?.*)?$`));
    await expect(
      page.getByRole("button", { name: "Show Artifacts" }),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("link", { name: articleTitle }),
    ).toHaveCount(0);
  });

  test("redirects the mobile profile root to posts", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/@${username}`);

    await expect(page).toHaveURL(new RegExp(`/@${username}/posts(\\?.*)?$`));

    const emptyState = page.getByText("No posts yet");
    const seededPostLink = page.getByRole("link", { name: postTitle });

    await Promise.race([
      emptyState.waitFor({ state: "visible", timeout: 10000 }),
      seededPostLink.waitFor({ state: "visible", timeout: 10000 }),
    ]);
  });

  test("does not show desktop chrome during mobile client navigation to the profile root", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.evaluate((rootHref) => {
      const testWindow = window as typeof window & {
        __desktopChromeSeen?: boolean;
        __profileRootHarnessMounted?: boolean;
        next: {
          router: {
            push: (href: string) => Promise<void> | void;
          };
        };
      };

      testWindow.__desktopChromeSeen = false;
      testWindow.__profileRootHarnessMounted = true;

      const recordDesktopChrome = () => {
        const bodyText = document.body?.innerText || "";
        const hasDesktopToggle =
          bodyText.includes("Show Artifacts") || bodyText.includes("Hide Artifacts");
        const hasDesktopPanel = !!document.querySelector(
          '[data-testid="desktop-content-panel"]',
        );

        if (hasDesktopToggle || hasDesktopPanel) {
          testWindow.__desktopChromeSeen = true;
        }
      };

      recordDesktopChrome();

      const observer = new MutationObserver(recordDesktopChrome);
      observer.observe(document.documentElement, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
      });

      const button = document.createElement("button");
      button.id = "profile-root-test-link";
      button.type = "button";
      button.textContent = "Open profile root";
      button.addEventListener("click", () => {
        void Promise.resolve(testWindow.next.router.push(rootHref));
      });
      document.body.appendChild(button);
    }, `/@${username}`);

    await page.locator("#profile-root-test-link").click();

    await expect(page).toHaveURL(new RegExp(`/@${username}/posts(\\?.*)?$`));

    const navigationState = await page.evaluate(() => {
      const testWindow = window as typeof window & {
        __desktopChromeSeen?: boolean;
        __profileRootHarnessMounted?: boolean;
      };

      return {
        desktopChromeSeen: testWindow.__desktopChromeSeen === true,
        sameDocumentNavigation: testWindow.__profileRootHarnessMounted === true,
      };
    });

    expect(navigationState.sameDocumentNavigation).toBe(true);
    expect(navigationState.desktopChromeSeen).toBe(false);
  });

  test("shows loading UI during list-to-detail navigation and returns to the typed list", async ({
    page,
  }) => {
    let delayedNavigation = false;

    await page.route(`**/${username}/articles/${articleSlug}*`, async (route) => {
      const headers = route.request().headers();
      const isPrefetch =
        headers["next-router-prefetch"] !== undefined ||
        headers.purpose === "prefetch";

      if (!delayedNavigation && !isPrefetch) {
        delayedNavigation = true;
        await new Promise((resolve) => setTimeout(resolve, 700));
      }

      await route.continue();
    });

    await page.goto(`/@${username}/articles`);

    const articleLink = page.getByRole("link", { name: articleTitle });
    await expect(articleLink).toBeVisible({ timeout: 10000 });

    await articleLink.click();

    await expect(page.getByTestId("article-detail-loading")).toBeVisible({
      timeout: 5000,
    });
    await expect(
      page.getByRole("heading", { name: articleTitle }),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(articleExcerpt)).toBeVisible({ timeout: 10000 });

    await page.getByRole("link", { name: "Back" }).click();

    await expect(page).toHaveURL(
      new RegExp(`/@${username}/articles(\\?.*)?$`),
    );
    await expect(articleLink).toBeVisible({ timeout: 10000 });
  });

  test("renders article detail on direct entry", async ({ page }) => {
    await page.goto(`/@${username}/articles/${articleSlug}`);

    await expect(
      page.getByRole("heading", { name: articleTitle }),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(articleExcerpt)).toBeVisible({ timeout: 10000 });
  });

  test("keeps article toolbar search and filter working", async ({ page }) => {
    await page.goto(`/@${username}/articles`);

    await page.getByRole("button", { name: "Search articles" }).click();

    const articleSearch = page.getByRole("searchbox", {
      name: "Search articles",
    });
    await articleSearch.fill("Creativity");

    await expect(
      page.getByRole("link", { name: creativityArticleTitle }),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("link", { name: articleTitle }),
    ).toHaveCount(0);

    await page.getByRole("button", { name: "Filter" }).click();
    await page.getByRole("menuitem", { name: /^Category/ }).click();
    await page
      .getByRole("menuitemcheckbox", { name: /Music & Sound/ })
      .click();

    await expect(
      page.getByText("No articles match your search and filters"),
    ).toBeVisible({ timeout: 10000 });
  });

  test("navigates to the posts tab", async ({ page }) => {
    let delayedNavigation = false;

    await page.route(`**/${username}/posts*`, async (route) => {
      if (!delayedNavigation && !isPrefetchRequest(route.request().headers())) {
        delayedNavigation = true;
        await new Promise((resolve) => setTimeout(resolve, 700));
      }

      await route.continue();
    });

    await page.goto(`/@${username}/articles`);

    await page.getByRole("tab", { name: "Posts" }).click();

    await expect(page.getByTestId("content-loading")).toBeVisible({
      timeout: 5000,
    });
    await expect(page).toHaveURL(new RegExp(`/@${username}/posts(\\?.*)?$`));

    const emptyState = page.getByText("No posts yet");
    const seededPostLink = page.getByRole("link", { name: postTitle });

    await Promise.race([
      emptyState.waitFor({ state: "visible", timeout: 10000 }),
      seededPostLink.waitFor({ state: "visible", timeout: 10000 }),
    ]);

    if (await emptyState.isVisible().catch(() => false)) {
      await expect(emptyState).toBeVisible();
      return;
    }

    await expect(seededPostLink).toBeVisible({ timeout: 10000 });
    await expect(
      page.locator("article").filter({ has: seededPostLink }).getByText(postCategory),
    ).toBeVisible({ timeout: 10000 });
    await seededPostLink.click();
    await expect(page).toHaveURL(new RegExp(`/@${username}/posts/.+`));
    await expect(
      page.getByRole("heading", { name: postTitle }),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.locator("article").getByText(postCategory),
    ).toBeVisible({ timeout: 10000 });
  });

  test("navigates back to the articles tab with loading UI", async ({
    page,
  }) => {
    let delayedNavigation = false;

    await page.route(`**/${username}/articles*`, async (route) => {
      if (!delayedNavigation && !isPrefetchRequest(route.request().headers())) {
        delayedNavigation = true;
        await new Promise((resolve) => setTimeout(resolve, 700));
      }

      await route.continue();
    });

    await page.goto(`/@${username}/posts`);

    await expect(
      page.getByRole("tab", { name: "Articles" }),
    ).toBeVisible({ timeout: 10000 });

    await page.getByRole("tab", { name: "Articles" }).click();

    await expect(page.getByTestId("content-loading")).toBeVisible({
      timeout: 5000,
    });
    await expect(page).toHaveURL(new RegExp(`/@${username}/articles(\\?.*)?$`));
    await expect(
      page.getByRole("link", { name: articleTitle }),
    ).toBeVisible({ timeout: 10000 });
  });

  test("searches, filters, sorts, and preserves post list state", async ({
    page,
  }) => {
    await page.goto(`/@${username}/posts`);

    await expect(
      page.getByRole("link", { name: newestPostTitle }),
    ).toBeVisible({ timeout: 10000 });

    await page.getByRole("button", { name: "Search posts" }).click();

    const postSearch = page.getByRole("searchbox", {
      name: "Search posts",
    });
    await postSearch.fill("Listening");

    await expect(
      page.getByRole("link", { name: oldestPostTitle }),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("link", { name: collaborationPostTitle }),
    ).toHaveCount(0);

    await postSearch.fill("Collaboration");

    await expect(
      page.getByRole("link", { name: collaborationPostTitle }),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("link", { name: oldestPostTitle }),
    ).toHaveCount(0);

    await page.getByRole("button", { name: "Search posts" }).click();

    await expect(
      page.locator("article h2").first(),
    ).toHaveText(newestPostTitle, { timeout: 10000 });

    await page.getByRole("button", { name: "Sort" }).click();
    await page.getByRole("menuitemradio", { name: "Oldest" }).click();

    await expect(
      page.locator("article h2").first(),
    ).toHaveText(oldestPostTitle, { timeout: 10000 });

    await page.getByRole("button", { name: "Filter" }).click();
    await expect(
      page.getByRole("menuitem", { name: /^Created/ }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("menuitem", { name: /^Status/ }),
    ).toHaveCount(0);
    await page.getByRole("menuitem", { name: /^Category/ }).click();
    await page
      .getByRole("menuitemcheckbox", { name: /Attention/ })
      .click();
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");

    await expect(
      page.getByRole("link", { name: oldestPostTitle }),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("link", { name: collaborationPostTitle }),
    ).toHaveCount(0);

    await page.getByRole("link", { name: oldestPostTitle }).click();
    await expect(
      page.getByRole("heading", { name: oldestPostTitle }),
    ).toBeVisible({ timeout: 10000 });

    await page.getByRole("link", { name: "Back" }).click();

    await expect(page).toHaveURL(new RegExp(`/@${username}/posts(\\?.*)?$`));
    await expect(
      page.locator("article h2").first(),
    ).toHaveText(oldestPostTitle, { timeout: 10000 });
    await expect(
      page.getByRole("link", { name: collaborationPostTitle }),
    ).toHaveCount(0);

    await page.getByRole("button", { name: "Filter" }).click();
    await page.getByRole("menuitem", { name: "Clear all filters" }).click();

    await page.getByRole("button", { name: "Filter" }).click();
    await page.getByRole("menuitem", { name: /^Published/ }).click();
    await page.getByRole("menuitemradio", { name: "This week" }).click();

    await expect(
      page.locator("article h2").first(),
    ).toHaveText(filteredWeekPostTitle, { timeout: 10000 });
    await expect(
      page.getByRole("link", { name: oldestPostTitle }),
    ).toHaveCount(0);

    await page.getByRole("button", { name: "Search posts" }).click();
    await page
      .getByRole("searchbox", { name: "Search posts" })
      .fill("Listening");

    await expect(
      page.getByText("No posts match your search and filters"),
    ).toBeVisible({ timeout: 10000 });
  });

  test("legacy slug routes no longer resolve", async ({ page }) => {
    await page.goto(`/@${username}/${articleSlug}`);

    await expect(page).toHaveURL(new RegExp(`/@${username}/${articleSlug}$`));
    await expect(page.getByText("This page could not be found.")).toBeVisible({
      timeout: 10000,
    });
  });
});
