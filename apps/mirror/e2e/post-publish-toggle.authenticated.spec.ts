import { test, expect } from "./fixtures/auth";

const username = "test-user"; // matches ensureTestUser's username
const testEmail = "playwright-test@mirror.test"; // matches auth.setup.ts

const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL!;
const testSecret = process.env.PLAYWRIGHT_TEST_SECRET!;

/**
 * Call the /test/ensure-post-fixtures HTTP action on the Convex backend.
 * Returns { draftSlug, publishedSlug }. Idempotent: resets posts to their
 * canonical fixture states (draft → draft, published → published).
 */
async function ensureTestPostFixtures(): Promise<{
  draftSlug: string;
  publishedSlug: string;
}> {
  const res = await fetch(`${convexSiteUrl}/test/ensure-post-fixtures`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-test-secret": testSecret,
    },
    body: JSON.stringify({ email: testEmail }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `ensure-post-fixtures failed with status ${res.status}: ${body}`,
    );
  }
  return res.json() as Promise<{ draftSlug: string; publishedSlug: string }>;
}

test.describe("Post publish toggle (authenticated owner)", () => {
  let draftSlug: string;
  let publishedSlug: string;

  // Reset fixtures before each owner-side test to ensure known state.
  test.beforeEach(async () => {
    const fixtures = await ensureTestPostFixtures();
    draftSlug = fixtures.draftSlug;
    publishedSlug = fixtures.publishedSlug;
  });

  test("owner can publish a draft post — toast appears and status label disappears (FR-03, FR-06, FR-09)", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`/@${username}/posts/${draftSlug}`, {
      waitUntil: "domcontentloaded",
    });

    // Status label ("Draft") should be visible for a draft post
    await expect(page.getByTestId("post-status-label")).toBeVisible({
      timeout: 10_000,
    });

    // Publish button should be visible for the owner
    const publishBtn = page.getByRole("button", { name: /^publish$/i });
    await expect(publishBtn).toBeVisible({ timeout: 5000 });
    await publishBtn.click();

    // Confirmation dialog appears
    await expect(page.getByRole("alertdialog")).toBeVisible({ timeout: 3000 });
    await expect(page.getByText("Publish this post?")).toBeVisible();

    // Confirm the publish — click the Publish button inside the dialog
    const dialogPublishBtn = page
      .getByRole("alertdialog")
      .getByRole("button", { name: /^publish$/i });
    await dialogPublishBtn.click();

    // Dialog should close
    await expect(page.getByRole("alertdialog")).not.toBeVisible({
      timeout: 3000,
    });

    // Success toast should appear (FR-06)
    await expect(page.getByText("Post published")).toBeVisible({
      timeout: 5000,
    });

    // Status label ("Draft") should disappear — Convex reactive update (FR-09)
    await expect(page.getByTestId("post-status-label")).not.toBeVisible({
      timeout: 5000,
    });
  });

  test("owner can unpublish a published post — status label reappears (FR-03, FR-06, FR-09)", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`/@${username}/posts/${publishedSlug}`, {
      waitUntil: "domcontentloaded",
    });

    // Published post: no "Draft" status label
    await expect(page.getByTestId("post-status-label")).not.toBeVisible({
      timeout: 10_000,
    });

    // Unpublish button visible for owner
    const unpublishBtn = page.getByRole("button", { name: /^unpublish$/i });
    await expect(unpublishBtn).toBeVisible({ timeout: 5000 });
    await unpublishBtn.click();

    // Confirmation dialog appears
    await expect(page.getByRole("alertdialog")).toBeVisible({ timeout: 3000 });
    await expect(
      page.getByText("Move this post back to drafts?"),
    ).toBeVisible();

    // Confirm unpublish — click Unpublish inside the dialog
    const dialogUnpublishBtn = page
      .getByRole("alertdialog")
      .getByRole("button", { name: /^unpublish$/i });
    await dialogUnpublishBtn.click();

    // Dialog closes
    await expect(page.getByRole("alertdialog")).not.toBeVisible({
      timeout: 3000,
    });

    // Success toast (FR-06)
    await expect(page.getByText("Post moved to drafts")).toBeVisible({
      timeout: 5000,
    });

    // Status label ("Draft") should reappear (FR-09)
    await expect(page.getByTestId("post-status-label")).toBeVisible({
      timeout: 5000,
    });
  });

  test("owner cancels the dialog — no change, no toast (FR-05)", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`/@${username}/posts/${draftSlug}`, {
      waitUntil: "domcontentloaded",
    });

    await expect(page.getByTestId("post-status-label")).toBeVisible({
      timeout: 10_000,
    });

    const publishBtn = page.getByRole("button", { name: /^publish$/i });
    await expect(publishBtn).toBeVisible({ timeout: 5000 });
    await publishBtn.click();

    // Dialog appears
    await expect(page.getByRole("alertdialog")).toBeVisible({ timeout: 3000 });

    // Cancel
    await page.getByRole("button", { name: /^cancel$/i }).click();

    // Dialog disappears
    await expect(page.getByRole("alertdialog")).not.toBeVisible({
      timeout: 3000,
    });

    // Status label still shows (no change — post remains a draft)
    await expect(page.getByTestId("post-status-label")).toBeVisible();

    // No toast fired
    await expect(page.getByText("Post published")).not.toBeVisible();
    await expect(page.getByText("Post moved to drafts")).not.toBeVisible();
  });

  test("non-owner cannot see publish toggle on published post (FR-01)", async ({
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

    // Post content should be visible (published post)
    await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });

    // Publish/unpublish toggle must NOT be present
    await expect(
      page.getByRole("button", { name: /^publish$|^unpublish$/i }),
    ).not.toBeVisible();

    await ctx.close();
  });

  test("non-owner navigating to draft URL sees not-found UI (FR-10)", async ({
    browser,
  }) => {
    // Create a fresh unauthenticated context — storageState must be explicitly
    // cleared because the authenticated project applies its storageState as
    // the default for browser.newContext() when no state is passed.
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();

    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`/@${username}/posts/${draftSlug}`, {
      waitUntil: "domcontentloaded",
    });

    // Should NOT render the post detail content
    await expect(page.getByTestId("post-status-label")).not.toBeVisible({
      timeout: 5000,
    });

    // Next.js notFound() renders a 404 page — h1 contains "404"
    await expect(page.locator("h1").filter({ hasText: "404" })).toBeVisible({
      timeout: 5000,
    });

    await ctx.close();
  });
});
