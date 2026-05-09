import { type Page } from "@playwright/test";
import { test, expect, waitForAuthReady } from "./fixtures/auth";

const username = "test-user";

const defaultHrefByLabel = {
  Bio: `/@${username}/bio`,
  Posts: `/@${username}/posts`,
  Articles: `/@${username}/articles`,
} as const;

type DefaultContentLabel = keyof typeof defaultHrefByLabel;

async function chooseDefaultContentType(
  page: Page,
  label: DefaultContentLabel,
) {
  await page.getByTestId("default-content-type-select").click();
  await page.getByRole("option", { name: label, exact: true }).click();

  const save = page.getByRole("button", { name: "Save", exact: true });
  await expect(save).toBeEnabled();
  await save.click();
  await expect(
    page.locator('[data-profile-settings-saving="false"]'),
  ).toBeVisible();
}

test.describe.serial("Settings default content type", () => {
  test("owner can choose the profile section opened by /@username", async ({
    authenticatedPage: page,
  }) => {
    await page.goto(`/@${username}/settings`);
    await waitForAuthReady(page);

    await expect(page.getByTestId("profile-tab-settings")).toBeVisible();
    await expect(page.getByTestId("settings-panel")).toBeVisible();
    await page.screenshot({
      path: "test-results/settings-default-content-type.png",
      fullPage: true,
    });

    const currentLabel = await page
      .getByTestId("default-content-type-select")
      .textContent();
    const targetLabel: DefaultContentLabel = currentLabel?.includes("Bio")
      ? "Articles"
      : "Bio";

    await chooseDefaultContentType(page, targetLabel);

    await page.goto(`/@${username}`);
    await expect(page).toHaveURL(
      new RegExp(`${defaultHrefByLabel[targetLabel]}(?:\\?|$)`),
    );

    await page.goto(`/@${username}/settings`);
    await waitForAuthReady(page);
    await chooseDefaultContentType(page, "Posts");
  });
});
