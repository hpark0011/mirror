import { test as base } from "@playwright/test";
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

// Unauthenticated negative case — the bare Playwright `test` (no stored
// auth state) confirms that visitors do not see the owner-only "Configure
// profile" affordance. A regression that drops the isOwner guard in
// profile-panel.tsx / workspace-panels.tsx would fail this test.
base.describe("Profile configuration helper chat — visibility", () => {
  base(
    "unauthenticated visitor does not see the Configure profile button",
    async ({ page }) => {
      await page.goto("/@test-user");
      await expect(
        page.getByRole("button", { name: "Configure profile" }),
      ).toHaveCount(0);
    },
  );
});
