import { test, expect, waitForAuthReady } from "./fixtures/auth";
import { requireEnv } from "./lib/env";

const username = "test-user";
const testEmail = "playwright-test@mirror.test";
const convexSiteUrl = requireEnv("NEXT_PUBLIC_CONVEX_SITE_URL");
const testSecret = requireEnv("PLAYWRIGHT_TEST_SECRET");

async function ensureTestArticleFixtures(): Promise<{
  draftSlug: string;
  publishedSlug: string;
}> {
  const res = await fetch(`${convexSiteUrl}/test/ensure-article-fixtures`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-test-secret": testSecret,
    },
    body: JSON.stringify({ email: testEmail }),
  });
  if (!res.ok) {
    throw new Error(
      `ensure-article-fixtures failed with status ${res.status}: ${await res.text()}`,
    );
  }
  return res.json() as Promise<{ draftSlug: string; publishedSlug: string }>;
}

test.describe("Article detail — Edit button (owner-only entry to editor)", () => {
  test("clicking Edit on the detail toolbar lands on the editor with title pre-filled", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    const { publishedSlug } = await ensureTestArticleFixtures();

    await page.goto(`/@${username}/articles/${publishedSlug}`, {
      waitUntil: "domcontentloaded",
    });
    await waitForAuthReady(page);

    // Owner sees the Edit button at the right end of the detail toolbar.
    const editBtn = page.getByTestId("edit-article-btn");
    await expect(editBtn).toBeVisible({ timeout: 10_000 });
    await expect(editBtn).toHaveText("Edit");

    await editBtn.click();

    // Lands on the editor route — slug-stable per identifiers.md.
    await expect(page).toHaveURL(
      new RegExp(`/@${username}/articles/${publishedSlug}/edit$`),
      { timeout: 10_000 },
    );

    // Editor scaffolding is mounted AND existing content is loaded
    // (title input is non-empty; slug input matches the URL slug).
    const titleInput = page.getByTestId("article-title-input");
    await expect(titleInput).toBeVisible({ timeout: 10_000 });
    await expect(titleInput).not.toHaveValue("");
    await expect(page.getByTestId("article-slug-input")).toHaveValue(
      publishedSlug,
    );

    // The editor's right-side Save button is present — proves we landed in
    // the editor toolbar shell, not just a loading state.
    await expect(page.getByTestId("save-article-btn")).toBeVisible();
  });

  test("Edit button preserves an open chat panel via ?chat=1", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    const { publishedSlug } = await ensureTestArticleFixtures();

    await page.goto(`/@${username}/articles/${publishedSlug}?chat=1`, {
      waitUntil: "domcontentloaded",
    });
    await waitForAuthReady(page);

    await page.getByTestId("edit-article-btn").click();

    // The chat-aware href appends ?chat=1 so the parallel chat panel
    // does not collapse on navigation.
    await expect(page).toHaveURL(
      new RegExp(
        `/@${username}/articles/${publishedSlug}/edit\\?chat=1(?:&|$)`,
      ),
      { timeout: 10_000 },
    );
  });
});
