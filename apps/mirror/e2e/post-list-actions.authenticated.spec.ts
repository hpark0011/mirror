import { test, expect, waitForAuthReady } from "./fixtures/auth";
import { requireEnv, requireEnvUrl } from "./lib/env";

const username = "post-list-actions-user";
const testEmail = "playwright-test@mirror.test";

const convexSiteUrl = requireEnvUrl("NEXT_PUBLIC_CONVEX_SITE_URL");
const testSecret = requireEnv("PLAYWRIGHT_TEST_SECRET");

async function ensureTestUser(): Promise<void> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);
  const res = await fetch(`${convexSiteUrl}/test/ensure-user`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-test-secret": testSecret,
    },
    body: JSON.stringify({ email: testEmail, username }),
    signal: controller.signal,
  }).finally(() => clearTimeout(timeoutId));
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `ensure-user failed with status ${res.status}: ${body}`,
    );
  }
}

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

test.describe.serial("Post list item actions", () => {
  let publishedSlug: string;

  test.beforeEach(async () => {
    await ensureTestUser();
    const fixtures = await ensureTestPostFixtures();
    publishedSlug = fixtures.publishedSlug;
  });

  test("owner hover reveals Edit and Delete actions", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`/@${username}/posts`, {
      waitUntil: "domcontentloaded",
    });
    await waitForAuthReady(page);
    await page.mouse.move(0, 0);

    const row = page.locator(
      `[data-testid="post-list-item"][data-post-slug="${publishedSlug}"]`,
    );
    await expect(row).toBeVisible({ timeout: 10_000 });

    await expect(row.getByTestId("post-list-edit-btn")).not.toBeVisible();
    await expect(row.getByTestId("post-list-delete-btn")).not.toBeVisible();

    await row.hover();

    await expect(row.getByTestId("post-list-edit-btn")).toBeVisible();
    await expect(row.getByTestId("post-list-delete-btn")).toBeVisible();
  });

  test("owner can open the editor from a post list item", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`/@${username}/posts`, {
      waitUntil: "domcontentloaded",
    });
    await waitForAuthReady(page);

    const row = page.locator(
      `[data-testid="post-list-item"][data-post-slug="${publishedSlug}"]`,
    );
    await expect(row).toBeVisible({ timeout: 10_000 });
    await row.hover();
    await row.getByTestId("post-list-edit-btn").click();

    await expect(page).toHaveURL(
      new RegExp(`/@${username}/posts/${publishedSlug}/edit$`),
      { timeout: 10_000 },
    );
    await expect(page.getByTestId("post-title-input")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId("post-slug-input")).toHaveValue(
      publishedSlug,
    );
  });

  test("owner edit action preserves an open chat panel", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`/@${username}/posts?chat=1`, {
      waitUntil: "domcontentloaded",
    });
    await waitForAuthReady(page);

    const row = page.locator(
      `[data-testid="post-list-item"][data-post-slug="${publishedSlug}"]`,
    );
    await expect(row).toBeVisible({ timeout: 10_000 });
    await row.hover();
    await row.getByTestId("post-list-edit-btn").click();

    await expect(page).toHaveURL(
      new RegExp(`/@${username}/posts/${publishedSlug}/edit\\?chat=1(?:&|$)`),
      { timeout: 10_000 },
    );
  });

  test("owner can delete a post from the list item", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`/@${username}/posts`, {
      waitUntil: "domcontentloaded",
    });
    await waitForAuthReady(page);

    const row = page.locator(
      `[data-testid="post-list-item"][data-post-slug="${publishedSlug}"]`,
    );
    await expect(row).toBeVisible({ timeout: 10_000 });
    await row.hover();
    await row.getByTestId("post-list-delete-btn").click();

    await expect(page.getByRole("alertdialog")).toBeVisible({ timeout: 3000 });
    await expect(page.getByText("Delete post")).toBeVisible();
    await expect(
      page.getByText("This will permanently delete this post"),
    ).toBeVisible();

    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: /^delete$/i })
      .click();

    await expect(row).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Post deleted")).toBeVisible({ timeout: 5000 });
  });

  test("visitor hover does not reveal owner actions", async ({ browser }) => {
    const ctx = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const page = await ctx.newPage();

    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`/@${username}/posts`, {
      waitUntil: "domcontentloaded",
    });

    const row = page.locator(
      `[data-testid="post-list-item"][data-post-slug="${publishedSlug}"]`,
    );
    await expect(row).toBeVisible({ timeout: 10_000 });
    await row.hover();

    await expect(row.getByTestId("post-list-edit-btn")).not.toBeVisible();
    await expect(row.getByTestId("post-list-delete-btn")).not.toBeVisible();

    await ctx.close();
  });
});
