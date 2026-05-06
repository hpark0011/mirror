import { test, expect, waitForAuthReady } from "./fixtures/auth";
import { ensureTestArticleFixtures } from "./fixtures/article-fixtures";
import { requireEnv } from "./lib/env";

const username = "test-user";
const testEmail = "playwright-test@mirror.test";

// ---------------------------------------------------------------------------
// FG_162: ensureTestPostFixtures helper — mirrors ensureTestArticleFixtures.
// Calls the /test/ensure-post-fixtures Convex HTTP action (gated by
// PLAYWRIGHT_TEST_SECRET) and returns { draftSlug, publishedSlug }.
// ---------------------------------------------------------------------------
async function ensureTestPostFixtures(): Promise<{
  draftSlug: string;
  publishedSlug: string;
}> {
  const convexSiteUrl = requireEnv("NEXT_PUBLIC_CONVEX_SITE_URL");
  const testSecret = requireEnv("PLAYWRIGHT_TEST_SECRET");
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
    await expect(back).toBeVisible({ timeout: 10_000 });
    await expect(back).toHaveRole("link");
    await expect(back).toHaveAccessibleName("Back");
    await expect(back).toHaveAttribute(
      "href",
      new RegExp(`/@${username}/articles(?:\\?|$)`),
    );
  });

  // FG_162: refactored to use ensureTestPostFixtures + direct navigation
  // instead of the brittle list-click selector.
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
    await expect(back).toBeVisible({ timeout: 10_000 });
    await expect(back).toHaveRole("link");
    await expect(back).toHaveAccessibleName("Back");
    await expect(back).toHaveAttribute(
      "href",
      new RegExp(`/@${username}/posts(?:\\?|$)`),
    );
  });

  test("article editor toolbar renders action mode with accessible name 'Back'", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    const { draftSlug } = await ensureTestArticleFixtures();

    await page.goto(`/@${username}/articles/${draftSlug}/edit`, {
      waitUntil: "domcontentloaded",
    });
    await waitForAuthReady(page);

    const back = page.getByTestId("workspace-back-button");
    await expect(back).toBeVisible({ timeout: 10_000 });
    await expect(back).toHaveRole("button");
    // Accessible name MUST equal the visible label (WCAG 2.5.3 Label in
    // Name) — voice-control users saying "click Back" must be able to
    // activate the editor's cancel affordance.
    await expect(back).toHaveAccessibleName("Back");
    // Action mode does not render an href attribute.
    await expect(back).not.toHaveAttribute("href", /.+/);
  });

  // FG_159: verify that ?chat=1 is preserved in the article detail back-button
  // href. buildChatAwareHref in article-detail-toolbar.tsx carries the chat
  // query param so the reader returns to a list URL that keeps the chat panel
  // open.
  test("article detail back button preserves ?chat=1", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    const { publishedSlug } = await ensureTestArticleFixtures();

    await page.goto(`/@${username}/articles/${publishedSlug}?chat=1`, {
      waitUntil: "domcontentloaded",
    });
    await waitForAuthReady(page);

    const back = page.getByTestId("workspace-back-button");
    await expect(back).toBeVisible({ timeout: 10_000 });
    await expect(back).toHaveAttribute("href", /chat=1/);
  });

  // FG_159: same preservation check for the post detail toolbar variant.
  test("post detail back button preserves ?chat=1", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    const { publishedSlug } = await ensureTestPostFixtures();

    await page.goto(`/@${username}/posts/${publishedSlug}?chat=1`, {
      waitUntil: "domcontentloaded",
    });
    await waitForAuthReady(page);

    const back = page.getByTestId("workspace-back-button");
    await expect(back).toBeVisible({ timeout: 10_000 });
    await expect(back).toHaveAttribute("href", /chat=1/);
  });

  // FG_161: clicking the editor's workspace-back-button (onCancel) must
  // navigate to the article detail URL — not stay on /edit.
  test("article editor cancel navigates back to article detail", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    const { draftSlug } = await ensureTestArticleFixtures();

    await page.goto(`/@${username}/articles/${draftSlug}/edit`, {
      waitUntil: "domcontentloaded",
    });
    await waitForAuthReady(page);

    const back = page.getByTestId("workspace-back-button");
    await expect(back).toBeVisible({ timeout: 10_000 });
    await back.click();

    // Assert we left /edit and landed on the article detail URL (no /edit suffix).
    await expect(page).toHaveURL(
      new RegExp(`/@${username}/articles/${draftSlug}(?:\\?|$|#)`),
    );
  });
});
