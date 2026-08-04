import { expect, test, type Page } from "@playwright/test";

const username = "rick-rubin";

async function gotoTab(page: Page, tab: "bio" | "articles" | "posts") {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto(`/@${username}/${tab}`, { waitUntil: "domcontentloaded" });
}

test.describe("Profile tabs dispatcher", () => {
  for (const start of ["posts", "articles"] as const) {
    test(`clicking Bio from ${start} navigates to the canonical section`, async ({
      page,
    }) => {
      await gotoTab(page, start);

      await page.getByRole("tab", { name: "Bio" }).click();

      await expect(page).toHaveURL(`/@${username}/bio`);
      await expect(page.getByTestId("bio-panel")).toBeVisible();
    });
  }

  test("Articles and Posts tabs navigate without query state", async ({
    page,
  }) => {
    await gotoTab(page, "posts");

    await page.getByRole("tab", { name: "Articles" }).click();
    await expect(page).toHaveURL(`/@${username}/articles`);

    await page.getByRole("tab", { name: "Posts" }).click();
    await expect(page).toHaveURL(`/@${username}/posts`);
  });

  test("cmd-click opens the canonical section in a new tab", async ({
    page,
    context,
  }) => {
    await gotoTab(page, "posts");
    const bioTab = page.getByRole("tab", { name: "Bio" });

    const [newPage] = await Promise.all([
      context.waitForEvent("page"),
      bioTab.click({ modifiers: ["Meta"] }),
    ]);

    await newPage.waitForURL(`/@${username}/bio`);
    expect(page.url()).toMatch(new RegExp(`/@${username}/posts$`));
    await newPage.close();
  });

  for (const tab of ["bio", "articles", "posts"] as const) {
    test(`direct ${tab} entry renders`, async ({ page }) => {
      await gotoTab(page, tab);

      await expect(
        page.getByRole("tab", {
          name:
            tab === "bio" ? "Bio" : tab === "articles" ? "Articles" : "Posts",
        }),
      ).toHaveAttribute("data-state", "active");
    });
  }
});
