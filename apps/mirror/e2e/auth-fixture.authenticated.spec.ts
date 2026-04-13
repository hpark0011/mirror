import { test, expect } from "./fixtures/auth";

test.describe("Auth fixture smoke", () => {
  test("authenticated page navigates to /dashboard without redirect to /sign-in", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/dashboard");
    // App may redirect authenticated users from /dashboard to their profile.
    // The only thing we require is that the auth fixture does NOT land on /sign-in.
    await expect(page).not.toHaveURL(/\/sign-in/);
    await expect(page).toHaveURL(/(dashboard|@test-user)/);
  });

  test("better-auth.session_token cookie is present in authenticated context", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/dashboard");
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find((c) =>
      c.name.startsWith("better-auth.session_token"),
    );
    expect(sessionCookie).toBeDefined();
  });

  test("GET /api/auth/get-session returns non-null session", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/dashboard");
    const response = await page.request.get("/api/auth/get-session");
    expect(response.ok()).toBe(true);
    const body = (await response.json()) as {
      session: unknown;
      user: unknown;
    } | null;
    expect(body).not.toBeNull();
    expect(body?.user ?? body?.session).toBeTruthy();
  });
});
