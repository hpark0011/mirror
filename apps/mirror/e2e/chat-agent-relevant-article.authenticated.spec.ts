import { expect, test, type Page } from "@playwright/test";
import { ensureTestArticleFixtures } from "./fixtures/article-fixtures";
import { sendChatMessage } from "./helpers/chat";
import { requireEnv } from "./lib/env";

/**
 * Regression for the "Greyboard AI" chat failure.
 *
 * The agent should not only check latest posts/articles for topical project
 * questions. It should call `findRelevantPublishedContent`, then reuse the
 * existing `navigateToContent` intent so the right panel opens the matching
 * article detail view.
 */

const ownerEmail = "relevant-article-owner@mirror.test";
const username = "relevant-article-owner";
const prompt =
  "What is greyboard ai? Pull up the relevant article if you have one.";
const NAVIGATION_TIMEOUT = 60_000;

test.describe.configure({ timeout: 90_000 });

async function ensureRelevantArticleOwner() {
  const convexSiteUrl = requireEnv("NEXT_PUBLIC_CONVEX_SITE_URL");
  const testSecret = requireEnv("PLAYWRIGHT_TEST_SECRET");

  const res = await fetch(`${convexSiteUrl}/test/ensure-user`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-test-secret": testSecret,
    },
    body: JSON.stringify({ email: ownerEmail, username }),
  });
  if (!res.ok) {
    throw new Error(
      `ensure relevant article owner failed with status ${res.status}: ${await res.text()}`,
    );
  }
}

async function openRelevantOwnerChat(page: Page) {
  await page.goto(`/@${username}?chat=1`);

  const textarea = page.locator('textarea[placeholder^="Message "]');
  await expect(textarea).toBeVisible({ timeout: 30000 });

  return textarea;
}

test("topical project question opens the relevant published article", async ({
  page,
}) => {
  await ensureRelevantArticleOwner();
  const fixtures = await ensureTestArticleFixtures({
    email: ownerEmail,
    relevantArticle: true,
  });
  expect(fixtures.relevantSlug).toBeTruthy();
  expect(fixtures.relevantTitle).toBeTruthy();

  const textarea = await openRelevantOwnerChat(page);

  await sendChatMessage(textarea, prompt);

  await page.waitForURL(
    new RegExp(`/@${username}/articles/${fixtures.relevantSlug}(?:[?#].*)?$`),
    { timeout: NAVIGATION_TIMEOUT },
  );

  await expect(page.locator("article h1").first()).toHaveText(
    fixtures.relevantTitle!,
    { timeout: NAVIGATION_TIMEOUT },
  );

  const url = page.url();
  expect(url).toContain(`/@${username}/articles/${fixtures.relevantSlug}`);
  expect(url).toMatch(/[?&]chat=1\b/);
  expect(url).toMatch(/[?&]conversation=[^&]+/);
  expect(url).not.toMatch(new RegExp(`/@${username}/posts(?:[/?#]|$)`));
  expect(url).not.toMatch(new RegExp(`/@${username}/articles(?:[?#]|$)`));
});
