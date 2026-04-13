import { test, expect } from "./fixtures/auth";

test.describe("Onboarding (authenticated)", () => {
  test("shows dashboard when onboardingComplete is true", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/(dashboard|@test-user)/);
  });

  test("no auth errors in console during dashboard page load", async ({
    authenticatedPage: page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/(dashboard|@test-user)/);
    await expect(page).not.toHaveURL(/\/sign-in/);

    const authErrors = consoleErrors.filter(
      (msg) =>
        msg.includes("Unauthenticated") || msg.includes("ConvexError")
    );
    expect(authErrors).toHaveLength(0);
  });
});
