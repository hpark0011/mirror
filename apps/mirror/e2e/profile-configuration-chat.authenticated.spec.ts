import { test, expect, waitForAuthReady } from "./fixtures/auth";

test.describe("Profile configuration helper chat", () => {
  test("owner Configure profile button opens chat in configuration mode", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/@test-user");
    await waitForAuthReady(page);

    await page.getByRole("button", { name: "Configure profile" }).click();

    await expect(page).toHaveURL(/[?&]chat=1\b/);
    await expect(page).toHaveURL(/[?&]chatMode=configuration\b/);
    await expect(
      page.getByPlaceholder(
        "Paste a resume, LinkedIn URL, or profile update...",
      ),
    ).toBeVisible();
  });
});
