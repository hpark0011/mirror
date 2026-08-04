import { expect, test } from "@playwright/test";

const username = "rick-rubin";
const articlesPath = `/@${username}/articles`;

test.describe("Single-surface profile workspace", () => {
  for (const viewport of [
    { name: "desktop", width: 1440, height: 960 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    test(`${viewport.name} profile root lands on full-width Articles`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto(`/@${username}?utm_source=discarded`);

      await expect(page).toHaveURL(articlesPath);
      await expect(page.getByRole("tab", { name: "Articles" })).toHaveAttribute(
        "data-state",
        "active",
      );

      const workspace = page.locator("main");
      await expect(workspace).toBeVisible();
      const bounds = await workspace.boundingBox();
      expect(bounds?.width).toBe(viewport.width);

      await expect(page.getByTestId("desktop-interaction-panel")).toHaveCount(
        0,
      );
      await expect(page.getByTestId("desktop-content-panel")).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: /profile panel/i }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: /content panel/i }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Edit Profile" }),
      ).toHaveCount(0);
      await expect(page.getByText("Text", { exact: true })).toHaveCount(0);
    });
  }

  test("legacy chat routes redirect silently to clean Articles", async ({
    page,
  }) => {
    await page.goto(`/@${username}/chat/old-conversation?source=discarded`);

    await expect(page).toHaveURL(articlesPath);
    await expect(page.getByRole("tab", { name: "Articles" })).toBeVisible();
  });

  test("chat-tainted content URLs redirect to clean Articles", async ({
    page,
  }) => {
    await page.goto(`/@${username}/bio?chat=1&tracking=discarded`);

    await expect(page).toHaveURL(articlesPath);
  });

  test("valid content query parameters remain intact", async ({ page }) => {
    await page.goto(`${articlesPath}?tracking=preserved`);

    await expect(page).toHaveURL(`${articlesPath}?tracking=preserved`);
  });
});
