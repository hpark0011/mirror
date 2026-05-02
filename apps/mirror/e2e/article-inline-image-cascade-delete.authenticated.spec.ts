import { test, expect } from "./fixtures/auth";
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

test.describe("Article inline image cascade delete (authenticated)", () => {
  test("article detail page is reachable for owner before deletion", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    const { draftSlug } = await ensureTestArticleFixtures();
    await page.goto(`/@${username}/articles/${draftSlug}`, {
      waitUntil: "domcontentloaded",
    });

    // Article detail page renders the title from the seeded fixture.
    await expect(page.getByText("Test Draft Article")).toBeVisible({
      timeout: 10_000,
    });
  });

  // FIXME: This scenario creates an article with three inline images plus a
  // cover image, deletes the article via `api.articles.mutations.remove`, and
  // asserts every blob is gone from Convex storage.
  //   1. Same e2e-only Convex client-mutation auth race documented in
  //      post-cover-image.authenticated.spec.ts:144-166 — `remove` fires
  //      before convex.setAuth runs and returns Unauthenticated.
  //   2. `ensureTestArticleFixtures` does not seed inline images or a cover
  //      image (extending it would require uploading 4 blobs and patching
  //      `body` + `coverImageStorageId`, deferred per wave-4 escape hatch).
  // See post-cover-image.authenticated.spec.ts:144-166 for the auth-race rationale.
  //
  // Coverage status with this test fixme'd:
  //   COVERED above:
  //     - article detail route reachable for owner
  //   NOT COVERED:
  //     - api.articles.mutations.remove cascade (FR-07)
  //     - inline blob storage cleanup at delete time
  //     - cover blob storage cleanup at delete time
  test.fixme(
    "deleting an article cascades to inline images and cover blob",
    async ({ authenticatedPage: page }) => {
      await page.setViewportSize({ width: 1440, height: 960 });
      const { draftSlug } = await ensureTestArticleFixtures();
      await page.goto(`/@${username}/articles/${draftSlug}`, {
        waitUntil: "domcontentloaded",
      });
    },
  );
});
