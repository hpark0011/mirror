import { expect, test } from "@playwright/test";

const username = "rick-rubin";

test.describe("Profile root default panel state", () => {
  test("desktop redirects to default content and lands with panel open", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`/@${username}`);

    await expect(page).toHaveURL(new RegExp(`/@${username}/posts(\\?.*)?$`));

    const contentRegion = page.getByTestId("desktop-content-panel");
    await expect(contentRegion).toHaveAttribute("data-state", "open", {
      timeout: 10000,
    });
    await expect(
      page.getByRole("button", { name: "Hide Artifacts" }),
    ).toBeVisible({ timeout: 5000 });
  });

  test("mobile redirects to default content (unchanged)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/@${username}`);

    await expect(page).toHaveURL(new RegExp(`/@${username}/posts(\\?.*)?$`));
  });
});
