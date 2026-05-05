import { test, expect, waitForAuthReady } from "./fixtures/auth";
import { requireEnv } from "./lib/env";
import { type Page } from "@playwright/test";
import path from "path";
import fs from "fs";

const username = "test-user"; // matches ensureTestUser's username
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

const TINY_RED_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==";

function writeTempPng(name: string): string {
  const tmpDir = path.join(__dirname, ".tmp");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const filePath = path.join(tmpDir, name);
  fs.writeFileSync(filePath, Buffer.from(TINY_RED_PNG_BASE64, "base64"));
  return filePath;
}

/**
 * Insert text via Tiptap's `insertContent` command directly so we don't depend
 * on the Playwright keyboard-typing rate; that's the same pattern other Tiptap
 * specs in this repo lean on for stability.
 */
async function typeIntoEditor(page: Page, text: string) {
  await page.evaluate((t) => {
    const win = window as typeof window & {
      __mirrorArticleEditor?: { insertText(text: string): void };
    };
    win.__mirrorArticleEditor?.insertText(t);
  }, text);
}

test.describe("Article editor — new article flow (FR-01..08)", () => {
  test("New button on the article list toolbar opens the editor at /articles/new", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`/@${username}/articles`, { waitUntil: "domcontentloaded" });

    const newBtn = page.getByTestId("new-article-btn");
    await expect(newBtn).toBeVisible({ timeout: 10_000 });
    await expect(newBtn).toBeEnabled();
    await newBtn.click();

    await expect(page).toHaveURL(new RegExp(`/@${username}/articles/new$`));

    // Editor scaffolding
    await expect(page.getByTestId("article-title-input")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId("article-slug-input")).toBeVisible();
    await expect(page.getByTestId("article-category-input")).toBeVisible();
    await expect(page.getByTestId("article-publish-toggle")).toBeVisible();
    await expect(page.getByTestId("article-cover-image-picker")).toBeVisible();
    await expect(page.locator(".tiptap-content .ProseMirror")).toBeVisible({
      timeout: 10_000,
    });

    // Workspace toolbar slot now hosts the editor's fixed format toolbar.
    await expect(page.getByTestId("article-editor-fixed-toolbar")).toBeVisible();
  });

  test("slug auto-derives from title and is overridable (identifiers.md)", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`/@${username}/articles/new`, {
      waitUntil: "domcontentloaded",
    });
    await waitForAuthReady(page);

    const title = page.getByTestId("article-title-input");
    const slug = page.getByTestId("article-slug-input");

    await title.fill("My First Article!");
    await expect(slug).toHaveValue("my-first-article");

    // Manual override sticks
    await slug.fill("custom-slug");
    await title.fill("Different Title");
    await expect(slug).toHaveValue("custom-slug");

    // Clearing slug re-derives on next title change
    await slug.fill("");
    await title.fill("Another Title");
    await expect(slug).toHaveValue("another-title");
  });

  test("slash command menu opens, navigates, and inserts a heading", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`/@${username}/articles/new`, {
      waitUntil: "domcontentloaded",
    });
    await waitForAuthReady(page);

    const editor = page.locator(".tiptap-content .ProseMirror");
    await expect(editor).toBeVisible({ timeout: 10_000 });
    await editor.click();

    await page.keyboard.type("/");
    const menu = page.getByTestId("slash-command-menu");
    await expect(menu).toBeVisible({ timeout: 5000 });
    await expect(menu.getByRole("option", { name: /Heading 1/i })).toBeVisible();
    await expect(menu.getByRole("option", { name: /Bullet List/i })).toBeVisible();
    await expect(menu.getByRole("option", { name: /Divider/i })).toBeVisible();

    // Filter, then Enter on the highlighted item
    await page.keyboard.type("head");
    await expect(menu.getByRole("option", { name: /Heading 1/i })).toBeVisible();
    await page.keyboard.press("Enter");

    await expect(menu).not.toBeVisible({ timeout: 3000 });
    await expect(editor.locator("h1")).toHaveCount(1, { timeout: 3000 });
  });

  test("text bubble menu shows on selection and toggles bold", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`/@${username}/articles/new`, {
      waitUntil: "domcontentloaded",
    });
    await waitForAuthReady(page);

    const editor = page.locator(".tiptap-content .ProseMirror");
    await expect(editor).toBeVisible({ timeout: 10_000 });
    await editor.click();

    await page.keyboard.type("Hello world");
    // Select all the body text
    await page.keyboard.press("Meta+A");

    const bubble = page.getByTestId("text-bubble-menu");
    await expect(bubble).toBeVisible({ timeout: 5000 });
    await expect(
      bubble.getByRole("button", { name: /^Bold/ }),
    ).toBeVisible();
    await expect(
      bubble.getByRole("button", { name: /^Italic/ }),
    ).toBeVisible();
    await expect(
      bubble.getByRole("button", { name: /^Link/ }),
    ).toBeVisible();

    await bubble.getByRole("button", { name: /^Bold/ }).click();
    await expect(editor.locator("strong")).toHaveText("Hello world");
  });

  test("fixed toolbar in the workspace slot toggles marks and reflects active state", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`/@${username}/articles/new`, {
      waitUntil: "domcontentloaded",
    });
    await waitForAuthReady(page);

    const toolbar = page.getByTestId("article-editor-fixed-toolbar");
    await expect(toolbar).toBeVisible({ timeout: 10_000 });

    // Required affordances
    await expect(toolbar.getByRole("button", { name: /^Undo/ })).toBeVisible();
    await expect(toolbar.getByRole("button", { name: /^Redo/ })).toBeVisible();
    await expect(
      toolbar.getByRole("button", { name: /^Bullet list/i }),
    ).toBeVisible();
    await expect(
      toolbar.getByRole("button", { name: /^Numbered list/i }),
    ).toBeVisible();

    const editor = page.locator(".tiptap-content .ProseMirror");
    await editor.click();
    await page.keyboard.type("scratch");
    await page.keyboard.press("Meta+A");

    const boldBtn = toolbar.getByRole("button", { name: /^Bold/ });
    await boldBtn.click();
    await expect(boldBtn).toHaveAttribute("data-active", "true");
    await expect(editor.locator("strong")).toHaveText("scratch");

    await boldBtn.click();
    await expect(boldBtn).toHaveAttribute("data-active", "false");
    await expect(editor.locator("strong")).toHaveCount(0);
  });

  test("cover image upload renders preview and persists storageId on save (FR-06)", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`/@${username}/articles/new`, {
      waitUntil: "domcontentloaded",
    });
    await waitForAuthReady(page);

    await page.getByTestId("article-title-input").fill("Article with cover");
    await page.getByTestId("article-category-input").fill("Process");

    const png = writeTempPng("article-cover.png");
    const fileInput = page
      .getByTestId("article-cover-image-picker")
      .locator('input[type="file"]');
    await fileInput.setInputFiles(png);

    const preview = page
      .getByTestId("article-cover-image-picker")
      .locator("img");
    await expect(preview).toBeVisible({ timeout: 10_000 });
    await expect(preview).toHaveAttribute(
      "src",
      /\.convex\.(cloud|site)\//,
    );

    await page.getByTestId("save-article-btn").click();
    await expect(page).toHaveURL(
      new RegExp(`/@${username}/articles/article-with-cover/edit$`),
      { timeout: 15_000 },
    );

    // Reload preserves the cover image
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(
      page.getByTestId("article-cover-image-picker").locator("img"),
    ).toHaveAttribute("src", /\.convex\.(cloud|site)\//, { timeout: 10_000 });
  });

  test("Save creates the article and redirects to /<slug>/edit (FR-07)", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`/@${username}/articles/new`, {
      waitUntil: "domcontentloaded",
    });
    await waitForAuthReady(page);

    await page.getByTestId("article-title-input").fill("Brand new piece");
    await page.getByTestId("article-category-input").fill("Inspiration");

    const editor = page.locator(".tiptap-content .ProseMirror");
    await editor.click();
    await typeIntoEditor(page, "First paragraph of body.");

    await page.getByTestId("save-article-btn").click();
    await expect(page).toHaveURL(
      new RegExp(`/@${username}/articles/brand-new-piece/edit$`),
      { timeout: 15_000 },
    );

    // List query reflects it
    await page.goto(`/@${username}/articles`, { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("link", { name: "Brand new piece" }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("Publish toggle commits status='published' and auto-sets publishedAt (FR-08, mutations.ts:190)", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`/@${username}/articles/new`, {
      waitUntil: "domcontentloaded",
    });
    await waitForAuthReady(page);

    await page.getByTestId("article-title-input").fill("Publish me");
    await page.getByTestId("article-category-input").fill("Process");
    const editor = page.locator(".tiptap-content .ProseMirror");
    await editor.click();
    await typeIntoEditor(page, "Body of a soon-to-be published article.");

    // Status starts as Draft → publishedAt slot is empty, button reads "Publish"
    const publishedAt = page.getByTestId("article-published-at");
    await expect(publishedAt).toHaveText(/—|Not yet|Unpublished/i);
    const publishToggle = page.getByTestId("article-publish-toggle");
    await expect(publishToggle).toHaveText(/^Publish$/);

    await publishToggle.click();
    const confirmDialog = page.getByRole("alertdialog");
    await confirmDialog.getByRole("button", { name: /^Publish$/ }).click();

    await expect(page).toHaveURL(
      new RegExp(`/@${username}/articles/publish-me/edit$`),
      { timeout: 15_000 },
    );

    // publishedAt now shows a real timestamp; toggle now reads "Unpublish"
    await expect(publishedAt).not.toHaveText(/—|Not yet|Unpublished/i, {
      timeout: 10_000,
    });
    await expect(publishToggle).toHaveText(/^Unpublish$/);

    // Round-trips
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(publishedAt).not.toHaveText(/—|Not yet|Unpublished/i, {
      timeout: 10_000,
    });
    await expect(publishToggle).toHaveText(/^Unpublish$/);
  });
});

test.describe("Article editor — edit existing article (FR-09)", () => {
  test("metadata fields and body populate from server, edits patch via update", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    const { draftSlug } = await ensureTestArticleFixtures();
    await page.goto(`/@${username}/articles/${draftSlug}/edit`, {
      waitUntil: "domcontentloaded",
    });
    await waitForAuthReady(page);

    // Metadata header populated
    await expect(page.getByTestId("article-title-input")).not.toHaveValue("", {
      timeout: 10_000,
    });
    await expect(page.getByTestId("article-slug-input")).toHaveValue(draftSlug);
    await expect(page.getByTestId("article-publish-toggle")).toHaveText(
      /^Publish$/,
    );

    // Edit title and save → URL stays on the SAME slug (slug field unchanged)
    const newTitle = `${Date.now()} edited`;
    await page.getByTestId("article-title-input").fill(newTitle);
    await page.getByTestId("save-article-btn").click();

    await expect(page).toHaveURL(
      new RegExp(`/@${username}/articles/${draftSlug}/edit$`),
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("article-title-input")).toHaveValue(newTitle, {
      timeout: 10_000,
    });
  });
});

test.describe("Article editor — inline image via slash (FR-10)", () => {
  test("/Image inserts a Convex-served inline image", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`/@${username}/articles/new`, {
      waitUntil: "domcontentloaded",
    });
    await waitForAuthReady(page);

    await page.getByTestId("article-title-input").fill("With inline image");
    await page.getByTestId("article-category-input").fill("Process");

    const editor = page.locator(".tiptap-content .ProseMirror");
    await editor.click();
    await page.keyboard.type("/image");

    const menu = page.getByTestId("slash-command-menu");
    await expect(menu.getByRole("option", { name: /^Image/ })).toBeVisible({
      timeout: 5000,
    });

    const png = writeTempPng("inline-image.png");
    const fileChooserPromise = page.waitForEvent("filechooser");
    await menu.getByRole("option", { name: /^Image/ }).click();
    const chooser = await fileChooserPromise;
    await chooser.setFiles(png);

    const inlineImg = editor.locator("img").first();
    await expect(inlineImg).toBeVisible({ timeout: 15_000 });
    await expect(inlineImg).toHaveAttribute(
      "src",
      /\.convex\.(cloud|site)\//,
    );
  });
});

test.describe("Article editor — slug uniqueness (FR-11)", () => {
  test("creating with a conflicting slug shows a toast and keeps editor mounted", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    const { draftSlug } = await ensureTestArticleFixtures();

    await page.goto(`/@${username}/articles/new`, {
      waitUntil: "domcontentloaded",
    });
    await waitForAuthReady(page);

    await page.getByTestId("article-title-input").fill("Conflict test");
    await page.getByTestId("article-category-input").fill("Process");
    await page.getByTestId("article-slug-input").fill(draftSlug);

    await page.getByTestId("save-article-btn").click();

    // Toast surfaces the slug conflict, editor stays open
    await expect(
      page.getByText(/slug.*(already|exists|taken)/i),
    ).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(new RegExp(`/@${username}/articles/new$`));
    await expect(page.getByTestId("article-title-input")).toHaveValue(
      "Conflict test",
    );
  });
});

test.describe("Article editor — draft visibility (FR-12)", () => {
  test("draft is hidden from public list but visible to owner with status=Draft filter", async ({
    authenticatedPage: ownerPage,
    browser,
  }) => {
    await ownerPage.setViewportSize({ width: 1440, height: 960 });
    await ownerPage.goto(`/@${username}/articles/new`, {
      waitUntil: "domcontentloaded",
    });
    await waitForAuthReady(ownerPage);

    const draftTitle = `Draft visibility ${Date.now()}`;
    await ownerPage.getByTestId("article-title-input").fill(draftTitle);
    await ownerPage.getByTestId("article-category-input").fill("Process");
    await ownerPage.getByTestId("save-article-btn").click();
    await expect(ownerPage).toHaveURL(/\/articles\/.+\/edit$/, {
      timeout: 15_000,
    });

    // Public list (unauthenticated) should not show the draft
    const publicCtx = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const publicPage = await publicCtx.newPage();
    await publicPage.setViewportSize({ width: 1440, height: 960 });
    await publicPage.goto(`/@${username}/articles`, {
      waitUntil: "domcontentloaded",
    });
    await expect(
      publicPage.getByRole("link", { name: draftTitle }),
    ).toHaveCount(0, { timeout: 10_000 });
    await publicCtx.close();

    // Owner sees it on the list page (no filter required for drafts to render)
    await ownerPage.goto(`/@${username}/articles`, {
      waitUntil: "domcontentloaded",
    });
    await expect(
      ownerPage.getByRole("link", { name: draftTitle }),
    ).toBeVisible({ timeout: 10_000 });
  });
});
