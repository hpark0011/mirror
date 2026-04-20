import { test, expect } from "./fixtures/auth";

/**
 * FR-14 of the waitlist spec: authenticated users hitting `/` are redirected
 * away from the closed-beta waitlist page. Uses the `authenticatedPage`
 * fixture, which loads the Better Auth session cookies saved by
 * `auth.setup.ts` into a fresh browser context.
 *
 * Note on the final landing URL: middleware redirects `/` → `/dashboard`,
 * and `/dashboard` itself redirects authenticated users with a completed
 * profile to their `/@username` page. Either destination satisfies FR-14 —
 * the invariant is "authed user does not see the waitlist form at `/`",
 * not a specific landing route.
 */
test("authenticated user is redirected away from / (FR-14)", async ({
  authenticatedPage: page,
}) => {
  // `page.goto("/")` triggers a 307 from middleware — Playwright sometimes
  // surfaces the abort of the original navigation as an error. Swallowing
  // it and then waiting for the final URL is the stable pattern.
  await page.goto("/", { waitUntil: "commit" }).catch(() => undefined);
  await page.waitForURL(/\/(dashboard|@.+)$/, { timeout: 10000 });
  await expect(page.getByTestId("home.waitlist.email-input")).toHaveCount(0);
});
