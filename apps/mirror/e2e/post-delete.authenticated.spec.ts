import { test, expect, waitForAuthReady } from "./fixtures/auth";
import { waitForDataState } from "./helpers/wait-for-data-state";
import { requireEnv } from "./lib/env";

const username = "test-user"; // matches ensureTestUser's username
const testEmail = "playwright-test@mirror.test"; // matches auth.setup.ts

const convexSiteUrl = requireEnv("NEXT_PUBLIC_CONVEX_SITE_URL");
const testSecret = requireEnv("PLAYWRIGHT_TEST_SECRET");

/**
 * Call the /test/ensure-post-fixtures HTTP action on the Convex backend.
 * Returns { draftSlug, publishedSlug }. Idempotent: resets posts to their
 * canonical fixture states (draft → draft, published → published).
 */
async function ensureTestPostFixtures(): Promise<{
  draftSlug: string;
  publishedSlug: string;
}> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);
  const res = await fetch(`${convexSiteUrl}/test/ensure-post-fixtures`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-test-secret": testSecret,
    },
    body: JSON.stringify({ email: testEmail }),
    signal: controller.signal,
  }).finally(() => clearTimeout(timeoutId));
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `ensure-post-fixtures failed with status ${res.status}: ${body}`,
    );
  }
  return res.json() as Promise<{ draftSlug: string; publishedSlug: string }>;
}

// Serial because Test 1 deletes the shared `publishedSlug` post on the Convex
// backend; under `fullyParallel: true`, a sibling test's `page.goto` would
// race the `beforeEach` re-seed and hit a 404. The publish-toggle sibling spec
// can stay parallel because its tests only toggle state, never destroy it.
test.describe.serial("Post delete (authenticated owner)", () => {
  let publishedSlug: string;

  // Reset fixtures before each owner-side test to ensure known state.
  test.beforeEach(async () => {
    const fixtures = await ensureTestPostFixtures();
    publishedSlug = fixtures.publishedSlug;
  });

  test("owner can delete a published post — dialog closes, toast appears, and navigates to posts list", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`/@${username}/posts/${publishedSlug}`, {
      waitUntil: "domcontentloaded",
    });

    // Wait for Convex client auth to settle
    await waitForAuthReady(page);

    // Delete button should be visible for the owner
    const deleteBtn = page.getByRole("button", { name: /^delete post$/i });
    await expect(deleteBtn).toBeVisible({ timeout: 5000 });
    await deleteBtn.click();

    // Confirmation dialog appears
    await expect(page.getByRole("alertdialog")).toBeVisible({ timeout: 3000 });
    await expect(page.getByText("Delete post")).toBeVisible();
    await expect(
      page.getByText("This will permanently delete this post"),
    ).toBeVisible();

    // Confirm the delete — click the Delete button inside the dialog.
    // Wrap click + URL change in Promise.all because the live `getById`
    // subscription on PostDetailConnector unmounts the dialog mid-navigation
    // when the server-side delete completes; without the Promise.all,
    // Playwright reports "Target page, context or browser has been closed".
    const dialogDeleteBtn = page
      .getByRole("alertdialog")
      .getByRole("button", { name: /^delete$/i });

    await Promise.all([
      page.waitForURL(`/@${username}/posts`, { timeout: 10_000 }),
      dialogDeleteBtn.click(),
    ]);

    // After URL flip the dialog is unmounted with the old route — assert toast.
    await expect(page.getByText("Post deleted")).toBeVisible({ timeout: 5000 });
  });

  test("owner can cancel the delete dialog — no mutation, no navigation", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`/@${username}/posts/${publishedSlug}`, {
      waitUntil: "domcontentloaded",
    });

    // Wait for Convex client auth to settle
    await waitForAuthReady(page);

    await expect(page.getByTestId("post-status-label")).not.toBeVisible({
      timeout: 10_000,
    });

    const deleteBtn = page.getByRole("button", { name: /^delete post$/i });
    await expect(deleteBtn).toBeVisible({ timeout: 5000 });

    // Trigger button reports the idle state via data-post-deleting="false"
    // before the user clicks delete. Asserting it here exercises the
    // producer-side attribute on a flow where the trigger remains mounted
    // (cancel doesn't unmount it like the success-navigate path does).
    await waitForDataState(page, "post-deleting", "false");

    await deleteBtn.click();

    // Dialog appears
    await expect(page.getByRole("alertdialog")).toBeVisible({ timeout: 3000 });

    // Cancel
    await page.getByRole("button", { name: /^cancel$/i }).click();

    // Dialog disappears
    await expect(page.getByRole("alertdialog")).not.toBeVisible({
      timeout: 3000,
    });

    // Delete button still visible (no mutation fired) and still at idle state
    await expect(deleteBtn).toBeVisible();
    await waitForDataState(page, "post-deleting", "false");

    // URL unchanged
    await expect(page).toHaveURL(`/@${username}/posts/${publishedSlug}`);

    // No success or error toast
    await expect(page.getByText("Post deleted")).not.toBeVisible();
  });

  test.skip(
    "error path — dialog stays open after mutation rejection",
    async () => {
      // Convex mutations transport over WebSocket (`wss://*.convex.cloud`),
      // so `page.route()` cannot intercept them. The error path is covered
      // at the hook level by FG_167's unit test
      // (apps/mirror/features/posts/__tests__/use-delete-post.test.ts).
      // Promote to an e2e if a fixture-based forced-rejection pattern
      // (mirroring bio's FR-09 in
      // apps/mirror/e2e/bio/bio-tab-owner-crud.authenticated.spec.ts:443-461)
      // becomes necessary for posts.
    },
  );

  test("non-owner cannot see delete button on published post", async ({
    browser,
  }) => {
    // Create a fresh unauthenticated context — storageState must be explicitly
    // cleared because the authenticated project applies its storageState as
    // the default for browser.newContext() when no state is passed.
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();

    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`/@${username}/posts/${publishedSlug}`, {
      waitUntil: "domcontentloaded",
    });

    // Wait for actual post content to render — H1 is guaranteed on a
    // published post detail page and is more reliable than waiting on
    // <main>, which can win the race before the post hydrates.
    await expect(
      page.getByRole("heading", { level: 1 }).first(),
    ).toBeVisible({ timeout: 10_000 });

    // Delete button must NOT be present
    await expect(
      page.getByRole("button", { name: /^delete post$/i }),
    ).not.toBeVisible();

    await ctx.close();
  });
});
