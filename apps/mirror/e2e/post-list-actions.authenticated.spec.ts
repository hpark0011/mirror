import { request as playwrightRequest, type Page } from "@playwright/test";
import { test as base, expect, waitForAuthReady } from "./fixtures/auth";
import { requireEnv, requireEnvUrl } from "./lib/env";

const fixtureId = `pla-${process.pid.toString(36)}-${Date.now().toString(36)}`;
const username = fixtureId;
const testEmail = `${fixtureId}@mirror.test`;

const convexSiteUrl = requireEnvUrl("NEXT_PUBLIC_CONVEX_SITE_URL");
const testSecret = requireEnv("PLAYWRIGHT_TEST_SECRET");

const test = base.extend<{ ownerPage: Page }>({
  ownerPage: async ({ baseURL, browser }, use) => {
    const origin = baseURL ?? "http://localhost:3306";
    const authRequest = await playwrightRequest.newContext({
      baseURL: origin,
      extraHTTPHeaders: { origin },
    });

    let context: Awaited<ReturnType<typeof browser.newContext>> | null = null;
    try {
      const sendOtpRes = await authRequest.post(
        "/api/auth/email-otp/send-verification-otp",
        {
          data: { email: testEmail, type: "sign-in" },
        },
      );
      if (!sendOtpRes.ok()) {
        throw new Error(
          `send-verification-otp failed with status ${sendOtpRes.status()}: ${await sendOtpRes.text()}`,
        );
      }

      const readOtpRes = await fetch(`${convexSiteUrl}/test/read-otp`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-test-secret": testSecret,
        },
        body: JSON.stringify({ email: testEmail }),
      });
      if (!readOtpRes.ok) {
        throw new Error(
          `read-otp failed with status ${readOtpRes.status}: ${await readOtpRes.text()}`,
        );
      }
      const { otp } = (await readOtpRes.json()) as { otp: string };

      const signInRes = await authRequest.post("/api/auth/sign-in/email-otp", {
        data: { email: testEmail, otp },
      });
      if (!signInRes.ok()) {
        throw new Error(
          `sign-in/email-otp failed with status ${signInRes.status()}: ${await signInRes.text()}`,
        );
      }

      await ensureTestUser();
      await ensureTestPostFixtures();
      await authRequest.post("/api/auth/convex/token");

      context = await browser.newContext({
        storageState: await authRequest.storageState(),
      });
      const page = await context.newPage();
      await use(page);
    } finally {
      await context?.close();
      await authRequest.dispose();
    }
  },
});

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
    const fixtures = await ensureTestPostFixtures();
    publishedSlug = fixtures.publishedSlug;
  });

  test("owner hover reveals Edit and Delete actions", async ({
    ownerPage: page,
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
    ownerPage: page,
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
    ownerPage: page,
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
    ownerPage: page,
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

  // FG_234: authenticated non-owner visiting another user's post list should
  // not see Edit or Delete buttons even on hover
  test("authenticated non-owner hover does not reveal owner actions", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    // Navigate to the ownerPage fixture's profile (a different account from test-user)
    await page.goto(`/@${username}/posts`, {
      waitUntil: "domcontentloaded",
    });
    await waitForAuthReady(page);

    const row = page.locator(
      `[data-testid="post-list-item"][data-post-slug="${publishedSlug}"]`,
    );
    await expect(row).toBeVisible({ timeout: 10_000 });
    await row.hover();

    await expect(row.getByTestId("post-list-edit-btn")).not.toBeVisible();
    await expect(row.getByTestId("post-list-delete-btn")).not.toBeVisible();
  });

  // FG_237: keyboard focus-within should reveal owner actions (no hover)
  test("keyboard focus inside a row reveals owner actions", async ({
    ownerPage: page,
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

    // Focus the edit link directly — no hover involved
    const editBtn = row.getByTestId("post-list-edit-btn");
    await editBtn.focus();

    await expect(editBtn).toBeVisible();
  });

  // FG_238: canceling the delete dialog from the list leaves the row intact
  test("owner can cancel the delete dialog — row stays, no toast", async ({
    ownerPage: page,
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

    // Confirmation dialog appears
    await expect(page.getByRole("alertdialog")).toBeVisible({ timeout: 3000 });

    // Cancel
    await page.getByRole("alertdialog").getByRole("button", { name: /^cancel$/i }).click();

    // Dialog dismissed
    await expect(page.getByRole("alertdialog")).not.toBeVisible({ timeout: 3000 });

    // Row is still visible — no optimistic removal
    await expect(row).toBeVisible();

    // Delete button still mounted (row hover needed to make it visible again)
    await row.hover();
    await expect(row.getByTestId("post-list-delete-btn")).toBeVisible();

    // No toast
    await expect(page.getByText("Post deleted")).not.toBeVisible();

    // URL unchanged
    await expect(page).toHaveURL(new RegExp(`/@${username}/posts$`));
  });
});
