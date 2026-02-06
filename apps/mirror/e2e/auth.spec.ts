import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test.describe("Middleware", () => {
    test("redirects unauthenticated users from protected routes to sign-in", async ({
      page,
    }) => {
      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/sign-in/);
    });

    test("preserves redirect query param after auth redirect", async ({
      page,
    }) => {
      await page.goto("/dashboard?tab=settings");
      await expect(page).toHaveURL(/\/sign-in.*next=/);
    });
  });

  test.describe("OTP Login Flow", () => {
    test("displays email form on sign-in page", async ({ page }) => {
      await page.goto("/sign-in");
      await expect(
        page.getByTestId("auth.otp-login.email-input")
      ).toBeVisible();
      await expect(
        page.getByTestId("auth.otp-login.submit-btn")
      ).toBeVisible();
    });

    test("shows Google OAuth button", async ({ page }) => {
      await page.goto("/sign-in");
      await expect(page.getByRole("button", { name: /google/i })).toBeVisible();
    });

    test("transitions to OTP verification step after email submission", async ({
      page,
    }) => {
      // Mock the Better Auth send-verification-otp endpoint
      await page.route("**/api/auth/email-otp/send-verification-otp", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ status: true }),
        })
      );

      await page.goto("/sign-in");

      // Fill and submit email
      await page.getByTestId("auth.otp-login.email-input").fill("test@example.com");
      await page.getByTestId("auth.otp-login.submit-btn").click();

      // Wait for transition to verify step
      await expect(page.getByTestId("auth.otp-login.otp-input")).toBeVisible({
        timeout: 5000,
      });
    });

    test("back button returns to email step", async ({ page }) => {
      // Mock the Better Auth send-verification-otp endpoint
      await page.route("**/api/auth/email-otp/send-verification-otp", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ status: true }),
        })
      );

      await page.goto("/sign-in");

      // Fill and submit email
      await page.getByTestId("auth.otp-login.email-input").fill("test@example.com");
      await page.getByTestId("auth.otp-login.submit-btn").click();

      // Wait for verify step
      await expect(page.getByTestId("auth.otp-login.otp-input")).toBeVisible({
        timeout: 5000,
      });

      // Click back button
      await page.getByTestId("auth.otp-login.back-btn").click();

      // Should be back on email step
      await expect(
        page.getByTestId("auth.otp-login.email-input")
      ).toBeVisible();
    });
  });

  test.describe("OTP Sign Up Flow", () => {
    test("displays email form on sign-up page", async ({ page }) => {
      await page.goto("/sign-up");
      await expect(
        page.getByTestId("auth.otp-sign-up.email-input")
      ).toBeVisible();
      await expect(
        page.getByTestId("auth.otp-sign-up.submit-btn")
      ).toBeVisible();
    });

    test("shows Google OAuth button", async ({ page }) => {
      await page.goto("/sign-up");
      await expect(page.getByRole("button", { name: /google/i })).toBeVisible();
    });
  });

  test.describe("Navigation Links", () => {
    test("sign-in page links to sign-up", async ({ page }) => {
      await page.goto("/sign-in");
      await page.getByRole("link", { name: /sign up/i }).click();
      await expect(page).toHaveURL("/sign-up");
    });

    test("sign-up page links to sign-in", async ({ page }) => {
      await page.goto("/sign-up");
      await page.getByRole("link", { name: /sign in/i }).click();
      await expect(page).toHaveURL("/sign-in");
    });
  });
});
