import { test, expect } from "./fixtures/auth";

test.describe("Onboarding (authenticated)", () => {
  test("visiting /onboarding with completed onboarding redirects to the user's profile", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/@test-user/);
  });

  test("dashboard renders for authed user with username", async ({
    authenticatedPage: page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page).not.toHaveURL(/\/sign-in/);

    const authErrors = consoleErrors.filter(
      (msg) =>
        msg.includes("Unauthenticated") || msg.includes("ConvexError")
    );
    expect(authErrors).toHaveLength(0);
  });
});
