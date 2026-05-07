import { test, expect, waitForAuthReady } from "./fixtures/auth";
import { ensureTestArticleFixtures } from "./fixtures/article-fixtures";

/**
 * test-user is the article owner (playwright-test@mirror.test).
 * The non-owner tests use the authenticatedPageNoUsername fixture
 * (playwright-no-username@mirror.test) — a different authenticated user
 * who cannot own @test-user's articles.
 */
const username = "test-user";

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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
      new RegExp(`/@${username}/articles/${escapeRegex(publishedSlug)}/edit$`),
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
        `/@${username}/articles/${escapeRegex(publishedSlug)}/edit\\?chat=1(?:&|$)`,
      ),
      { timeout: 10_000 },
    );
  });

  /**
   * Non-owner test: a different authenticated user (playwright-no-username@mirror.test)
   * visits @test-user's article and must NOT see the Edit button.
   *
   * Uses the non-owner fixture pattern from
   * apps/mirror/e2e/clone-settings/non-owner-hidden-tab-and-404.spec.ts and
   * apps/mirror/e2e/bio/bio-tab-cross-user.authenticated.spec.ts.
   */
  test("non-owner viewers cannot see the Edit button on article detail", async ({
    authenticatedPageNoUsername: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    const { publishedSlug } = await ensureTestArticleFixtures();

    // Navigate to the owner's published article as a non-owner authenticated user.
    await page.goto(`/@${username}/articles/${publishedSlug}`, {
      waitUntil: "domcontentloaded",
    });
    await waitForAuthReady(page);

    // The back button must be visible — confirming the toolbar rendered and
    // this is not a false negative caused by the page failing to load.
    const back = page.getByTestId("workspace-back-button");
    await expect(back).toBeVisible({ timeout: 10_000 });

    // The Edit button MUST NOT appear for a non-owner viewer.
    const editBtn = page.getByTestId("edit-article-btn");
    await expect(editBtn).toHaveCount(0);
  });
});
