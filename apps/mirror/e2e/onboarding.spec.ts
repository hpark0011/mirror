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

  // Authenticated tests require a real Better Auth session cookie.
  // isAuthenticated() in the server component reads cookies via next/headers
  // and validates them server-to-server — Playwright route mocking can't
  // intercept this. These tests need a test auth seed mechanism (e.g.,
  // a test-only API route that sets a valid session cookie).
  test.describe("Authenticated access", () => {
    test.fixme(
      "shows username step when authenticated user has no username",
      async ({ page }) => {
        // TODO: Set a valid Better Auth session cookie before navigating.
        // await page.context().addCookies([{
        //   name: 'better-auth.session_token',
        //   value: '<valid-test-session-token>',
        //   domain: 'localhost',
        //   path: '/',
        // }]);
        await page.goto("/onboarding");
        await expect(page).toHaveURL(/\/onboarding/);
        await expect(
          page.getByRole("heading", { name: "Choose your username" })
        ).toBeVisible();
        await expect(
          page.getByPlaceholder("your-username")
        ).toBeVisible();
        await expect(
          page.getByRole("button", { name: "Continue" })
        ).toBeVisible();
      }
    );

    test.fixme(
      "no auth errors in console during page load",
      async ({ page }) => {
        const consoleErrors: string[] = [];
        page.on("console", (msg) => {
          if (msg.type() === "error") {
            consoleErrors.push(msg.text());
          }
        });

        // TODO: Set a valid Better Auth session cookie before navigating.
        await page.goto("/onboarding");
        await expect(page).toHaveURL(/\/onboarding/);

        const authErrors = consoleErrors.filter(
          (msg) =>
            msg.includes("Unauthenticated") || msg.includes("ConvexError")
        );
        expect(authErrors).toHaveLength(0);
      }
    );
  });
});
