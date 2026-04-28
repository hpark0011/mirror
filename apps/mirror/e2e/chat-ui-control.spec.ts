import { expect, test, type Page } from "@playwright/test";

const username = "rick-rubin";
const pageErrorsByPage = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const pageErrors: string[] = [];
  pageErrorsByPage.set(page, pageErrors);
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });
});

test.afterEach(async ({ page }, testInfo) => {
  const pageErrors = pageErrorsByPage.get(page) ?? [];
  if (pageErrors.length > 0) {
    await testInfo.attach("page-errors", {
      body: pageErrors.join("\n"),
      contentType: "text/plain",
    });
  }

  expect(pageErrors).toEqual([]);
});

async function openChat(page: Page, path = `/@${username}?chat=1`) {
  await page.goto(path);
  const textarea = page.locator('textarea[placeholder^="Message "]');
  await expect(textarea).toBeVisible({ timeout: 10000 });
  return textarea;
}

async function sendPrompt(page: Page, prompt: string) {
  const textarea = page.locator('textarea[placeholder^="Message "]');
  await textarea.fill(prompt);
  await textarea.press("Enter");
}

async function expectConversationParam(page: Page) {
  await expect.poll(() => {
    const url = new URL(page.url());
    return url.searchParams.get("conversation") !== null;
  }, { timeout: 10000 }).toBe(true);
}

test.describe("Chat UI control", () => {
  test("opens articles and applies a search from the public chat prompt", async ({
    page,
  }) => {
    await openChat(page);

    await sendPrompt(page, "[ui-control-test] show articles about music");

    await expect(page.getByText("Showing articles about music.")).toBeVisible({
      timeout: 15000,
    });
    await expect(page).toHaveURL(/\/@rick-rubin\/articles\?/);
    await expectConversationParam(page);

    const searchInput = page.getByRole("searchbox", {
      name: "Search articles",
    });
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toHaveValue("music");
    await expect(page.getByText("The Art of Listening")).toBeVisible();
  });

  test("navigates from a detail page to posts and sorts oldest first", async ({
    page,
  }) => {
    await openChat(page, `/@${username}/posts/the-source-is-everywhere?chat=1`);

    await sendPrompt(
      page,
      "[ui-control-test] go back to posts and sort oldest",
    );

    await expect(
      page.getByText("Showing posts sorted oldest first."),
    ).toBeVisible({ timeout: 15000 });
    await expect(page).toHaveURL(/\/@rick-rubin\/posts\?/);
    await expectConversationParam(page);

    const firstPost = page.locator("a", { hasText: "Listening Before Speaking" }).first();
    await expect(firstPost).toBeVisible();
  });

  test("clears active list controls from the public chat prompt", async ({
    page,
  }) => {
    await openChat(page);

    await sendPrompt(page, "[ui-control-test] show articles about music");
    await expect(page.getByText("Showing articles about music.")).toBeVisible({
      timeout: 15000,
    });
    await expect(
      page.getByRole("searchbox", { name: "Search articles" }),
    ).toHaveValue("music");

    await sendPrompt(page, "[ui-control-test] clear filters");

    await expect(page.getByText("Cleared the list controls.")).toBeVisible({
      timeout: 15000,
    });
    await expect(
      page.getByRole("searchbox", { name: "Search articles" }),
    ).toHaveValue("");
  });
});
