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
    throw new Error(
      `ensure-post-fixtures failed with status ${res.status}: ${await res.text()}`,
    );
  }
  return res.json() as Promise<{ draftSlug: string; publishedSlug: string }>;
}

test.describe("Workspace back button — unified component", () => {
  test("article detail toolbar renders link mode with name 'Back'", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    const { publishedSlug } = await ensureTestArticleFixtures();

    await page.goto(`/@${username}/articles/${publishedSlug}`, {
      waitUntil: "domcontentloaded",
    });
    await waitForAuthReady(page);

    const back = page.getByTestId("workspace-back-button");
    await expect(back).toHaveCount(1);
    await expect(back).toBeVisible({ timeout: 10_000 });
    await expect(back).toHaveRole("link");
    await expect(back).toHaveAccessibleName("Back");
    await expect(back).toHaveAttribute(
      "href",
      new RegExp(`/@${username}/articles(?:\\?|$)`),
    );
  });

  test("post detail toolbar renders link mode with href to /posts", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    const { publishedSlug } = await ensureTestPostFixtures();

    await page.goto(`/@${username}/posts/${publishedSlug}`, {
      waitUntil: "domcontentloaded",
    });
    await waitForAuthReady(page);

    const back = page.getByTestId("workspace-back-button");
    await expect(back).toHaveCount(1);
    await expect(back).toBeVisible({ timeout: 10_000 });
    await expect(back).toHaveRole("link");
    await expect(back).toHaveAccessibleName("Back");
    await expect(back).toHaveAttribute(
      "href",
      new RegExp(`/@${username}/posts(?:\\?|$)`),
    );
  });

  test("article editor toolbar renders action mode with name 'Back' and no href", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    const { draftSlug } = await ensureTestArticleFixtures();

    await page.goto(`/@${username}/articles/${draftSlug}/edit`, {
      waitUntil: "domcontentloaded",
    });
    await waitForAuthReady(page);

    const back = page.getByTestId("workspace-back-button");
    await expect(back).toHaveCount(1);
    await expect(back).toBeVisible({ timeout: 10_000 });
    await expect(back).toHaveRole("button");
    await expect(back).toHaveAccessibleName("Back");
    await expect(back).not.toHaveAttribute("href", /.+/);
  });
});
