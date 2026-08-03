import { expect, test, type Page } from "@playwright/test";

const username = "rick-rubin";
const featuredSlug = "nature-and-the-creative-process";

async function gotoArticles(page: Page) {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto(`/@${username}/articles`, { waitUntil: "domcontentloaded" });
}

test.describe("Article featured-card dispatcher", () => {
  test("plain left-click navigates in the current tab", async ({
    page,
    context,
  }) => {
    await gotoArticles(page);

    const featuredCard = page.getByTestId("article-list-featured-card").first();
    await expect(featuredCard).toBeVisible({ timeout: 10_000 });
    const initialPageCount = context.pages().length;

    await featuredCard.click();

    await expect(page).toHaveURL(
      new RegExp(`/@${username}/articles/${featuredSlug}$`),
    );
    expect(context.pages().length).toBe(initialPageCount);
  });

  test("cmd-click opens the canonical URL in a new tab", async ({
    page,
    context,
  }) => {
    await gotoArticles(page);

    const featuredCard = page.getByTestId("article-list-featured-card").first();
    await expect(featuredCard).toBeVisible({ timeout: 10_000 });

    const [newPage] = await Promise.all([
      context.waitForEvent("page"),
      featuredCard.click({ modifiers: ["Meta"] }),
    ]);

    await newPage.waitForURL(
      new RegExp(`/@${username}/articles/${featuredSlug}$`),
    );
    expect(page.url()).toMatch(new RegExp(`/@${username}/articles$`));

    await newPage.close();
  });
});
