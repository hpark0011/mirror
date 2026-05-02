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

test.describe("Article inline image replace / delete-on-save (authenticated)", () => {
  test("article edit page renders for owner and exposes save control", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    const { draftSlug } = await ensureTestArticleFixtures();
    await page.goto(`/@${username}/articles/${draftSlug}/edit`, {
      waitUntil: "domcontentloaded",
    });

    await expect(page.locator(".tiptap-content")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId("save-article-btn")).toBeVisible();
  });

  // FIXME: This scenario seeds an article with two inline images, deletes one
  // in the editor, saves, and asserts the removed blob is gone from Convex
  // storage. It hits two blockers:
  //   1. The same e2e-only Convex client-mutation auth race documented in
  //      post-cover-image.authenticated.spec.ts:144-166 — `api.articles.mutations.update`
  //      fires before convex.setAuth runs and returns Unauthenticated.
  //   2. The `ensureTestArticleFixtures` HTTP endpoint seeds empty bodies. To
  //      pre-populate a body with two inline image nodes referencing real
  //      storageIds we'd need a deeper fixture (upload two blobs via
  //      ctx.storage, set body to reference them) — out of scope for this
  //      wave per the wave-4 escape hatch.
  // See post-cover-image.authenticated.spec.ts:144-166 for the auth-race rationale.
  //
  // Coverage status with this test fixme'd:
  //   COVERED above:
  //     - article edit route is reachable and editor mounts for owner
  //   NOT COVERED:
  //     - delete-on-save body diffing (FR-06 multiset diff)
  //     - storage cleanup of removed inline blob
  //     - surviving image renders on reload
  test.fixme(
    "delete one of two inline images and save removes only that blob",
    async ({ authenticatedPage: page }) => {
      // See FIXME comment above; the runnable assertions live in the test
      // sibling. Implementation deferred until the auth race + extended
      // fixture seeding are addressed in a follow-up.
      await page.setViewportSize({ width: 1440, height: 960 });
      const { draftSlug } = await ensureTestArticleFixtures();
      await page.goto(`/@${username}/articles/${draftSlug}/edit`, {
        waitUntil: "domcontentloaded",
      });
    },
  );
});
