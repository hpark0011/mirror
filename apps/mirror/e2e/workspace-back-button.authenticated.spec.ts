import { test, expect, waitForAuthReady } from "./fixtures/auth";
import { ensureTestArticleFixtures } from "./fixtures/article-fixtures";

const username = "test-user";

test.describe("Workspace back button — unified component", () => {
  test("article detail toolbar renders link mode with name 'Back'", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    const { publishedSlug } = await ensureTestArticleFixtures();

    await page.goto(`/@${username}/articles/${publishedSlug}`, {
      waitUntil: "domcontentloaded",
    });
    await waitForAuthReady(page);

    const back = page.getByTestId("workspace-back-button");
    await expect(back).toBeVisible({ timeout: 10_000 });
    await expect(back).toHaveRole("link");
    await expect(back).toHaveAccessibleName("Back");
    await expect(back).toHaveAttribute(
      "href",
      new RegExp(`/@${username}/articles(?:\\?|$)`),
    );
  });

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
    await waitForAuthReady(page);

    const back = page.getByTestId("workspace-back-button");
    await expect(back).toBeVisible({ timeout: 10_000 });
    await expect(back).toHaveRole("link");
    await expect(back).toHaveAccessibleName("Back");
    await expect(back).toHaveAttribute(
      "href",
      new RegExp(`/@${username}/posts(?:\\?|$)`),
    );
  });

  test("article editor toolbar renders action mode with aria-label 'Cancel'", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    const { draftSlug } = await ensureTestArticleFixtures();

    await page.goto(`/@${username}/articles/${draftSlug}/edit`, {
      waitUntil: "domcontentloaded",
    });
    await waitForAuthReady(page);

    const back = page.getByTestId("workspace-back-button");
    await expect(back).toBeVisible({ timeout: 10_000 });
    await expect(back).toHaveRole("button");
    await expect(back).toHaveAccessibleName("Cancel");
    // Action mode does not render an href attribute.
    await expect(back).not.toHaveAttribute("href", /.+/);
  });
});
