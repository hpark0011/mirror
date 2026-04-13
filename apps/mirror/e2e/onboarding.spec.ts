import { test, expect } from "@playwright/test";

test.describe("Onboarding", () => {
  test.describe("Unauthenticated access", () => {
    test("redirects unauthenticated users from /onboarding to /sign-in", async ({
      page,
    }) => {
      await page.goto("/onboarding");
      await expect(page).toHaveURL(/\/sign-in/);
    });

    test("preserves redirect query param after auth redirect", async ({
      page,
    }) => {
      await page.goto("/onboarding");
      await expect(page).toHaveURL(/\/sign-in.*next=/);
    });
  });

});
