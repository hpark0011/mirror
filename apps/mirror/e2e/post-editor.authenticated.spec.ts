import { test, expect, waitForAuthReady } from "./fixtures/auth";
import { requireEnv } from "./lib/env";
import { type Page } from "@playwright/test";
import path from "path";
import fs from "fs";

const username = "test-user"; // matches ensureTestUser's username
const testEmail = "playwright-test@mirror.test";

const convexSiteUrl = requireEnv("NEXT_PUBLIC_CONVEX_SITE_URL");
const testSecret = requireEnv("PLAYWRIGHT_TEST_SECRET");

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

// 1x1 red PNG. Smallest valid PNG that satisfies the PNG MIME sniff and the
// cover picker's accept filter.
const TINY_RED_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==";

function writeTempPng(name: string): string {
  const tmpDir = path.join(__dirname, ".tmp");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const filePath = path.join(tmpDir, name);
  fs.writeFileSync(filePath, Buffer.from(TINY_RED_PNG_BASE64, "base64"));
  return filePath;
}

async function typeIntoEditor(page: Page, text: string) {
  await page.evaluate((t) => {
    const win = window as typeof window & {
      __mirrorArticleEditor?: { insertText(text: string): void };
    };
    win.__mirrorArticleEditor?.insertText(t);
  }, text);
}

test.describe("Post editor — new post flow", () => {
  test("New button on the post list toolbar opens the editor at /posts/new", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`/@${username}/posts`, {
      waitUntil: "domcontentloaded",
    });

    const newBtn = page.getByTestId("new-post-btn");
    await expect(newBtn).toBeVisible({ timeout: 10_000 });
    await expect(newBtn).toBeEnabled();
    await newBtn.click();

    await expect(page).toHaveURL(new RegExp(`/@${username}/posts/new$`));

    await expect(page.getByTestId("post-title-input")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId("post-slug-input")).toBeVisible();
    await expect(page.getByTestId("post-category-input")).toBeVisible();
    await expect(page.getByTestId("post-publish-toggle")).toBeVisible();
    await expect(page.getByTestId("post-cover-image-picker")).toBeVisible();
    await expect(page.locator(".tiptap-content .ProseMirror")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("slug auto-derives from title and is overridable", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`/@${username}/posts/new`, {
      waitUntil: "domcontentloaded",
    });
    await waitForAuthReady(page);

    const title = page.getByTestId("post-title-input");
    const slug = page.getByTestId("post-slug-input");

    await title.fill("My First Post!");
    await expect(slug).toHaveValue("my-first-post");

    // Manual override sticks
    await slug.fill("custom-slug");
    await title.fill("Different Title");
    await expect(slug).toHaveValue("custom-slug");

    // Clearing slug re-derives on next title change
    await slug.fill("");
    await title.fill("Another Title");
    await expect(slug).toHaveValue("another-title");
  });

  test("Save creates the post and redirects to /<slug>/edit", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`/@${username}/posts/new`, {
      waitUntil: "domcontentloaded",
    });
    await waitForAuthReady(page);

    const title = `Brand new post ${Date.now()}`;
    await page.getByTestId("post-title-input").fill(title);
    await page.getByTestId("post-category-input").fill("Notes");

    const editor = page.locator(".tiptap-content .ProseMirror");
    await editor.click();
    await typeIntoEditor(page, "First paragraph of body.");

    await page.getByTestId("save-post-btn").click();
    await expect(page).toHaveURL(
      new RegExp(`/@${username}/posts/brand-new-post-\\d+/edit$`),
      { timeout: 15_000 },
    );

    // List query reflects it (owner view shows drafts inline)
    await page.goto(`/@${username}/posts`, { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("link", { name: title }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("cover image upload renders preview and persists on save", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`/@${username}/posts/new`, {
      waitUntil: "domcontentloaded",
    });
    await waitForAuthReady(page);

    const title = `Post with cover ${Date.now()}`;
    await page.getByTestId("post-title-input").fill(title);
    await page.getByTestId("post-category-input").fill("Notes");

    const png = writeTempPng("post-cover.png");
    const fileInput = page
      .getByTestId("post-cover-image-picker")
      .locator('input[type="file"]');
    await fileInput.setInputFiles(png);

    const preview = page
      .getByTestId("post-cover-image-picker")
      .locator("img");
    await expect(preview).toBeVisible({ timeout: 10_000 });
    await expect(preview).toHaveAttribute(
      "src",
      /\.convex\.(cloud|site)\/|^blob:/,
    );

    await page.getByTestId("save-post-btn").click();
    await expect(page).toHaveURL(
      new RegExp(`/@${username}/posts/post-with-cover-\\d+/edit$`),
      { timeout: 15_000 },
    );

    // Reload preserves the cover image
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(
      page.getByTestId("post-cover-image-picker").locator("img"),
    ).toHaveAttribute("src", /\.convex\.(cloud|site)\//, { timeout: 10_000 });
  });

  test("publish toggle commits status='published' and auto-sets publishedAt", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`/@${username}/posts/new`, {
      waitUntil: "domcontentloaded",
    });
    await waitForAuthReady(page);

    const title = `Publish me ${Date.now()}`;
    await page.getByTestId("post-title-input").fill(title);
    await page.getByTestId("post-category-input").fill("Notes");
    const editor = page.locator(".tiptap-content .ProseMirror");
    await editor.click();
    await typeIntoEditor(page, "Body of a soon-to-be published post.");

    const publishedAt = page.getByTestId("post-published-at");
    await expect(publishedAt).toHaveText(/—|Not yet|Unpublished/i);
    const publishToggle = page.getByTestId("post-publish-toggle");
    await expect(publishToggle).toHaveText(/^Publish$/);

    await publishToggle.click();
    const confirmDialog = page.getByRole("alertdialog");
    await confirmDialog.getByRole("button", { name: /^Publish$/ }).click();

    await expect(page).toHaveURL(
      new RegExp(`/@${username}/posts/publish-me-\\d+/edit$`),
      { timeout: 15_000 },
    );

    await expect(publishedAt).not.toHaveText(/—|Not yet|Unpublished/i, {
      timeout: 10_000,
    });
    await expect(publishToggle).toHaveText(/^Unpublish$/);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(publishedAt).not.toHaveText(/—|Not yet|Unpublished/i, {
      timeout: 10_000,
    });
    await expect(publishToggle).toHaveText(/^Unpublish$/);
  });
});

test.describe("Post editor — edit existing post", () => {
  test("metadata fields populate from server, edits patch via update", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    const { draftSlug } = await ensureTestPostFixtures();
    await page.goto(`/@${username}/posts/${draftSlug}/edit`, {
      waitUntil: "domcontentloaded",
    });
    await waitForAuthReady(page);

    await expect(page.getByTestId("post-title-input")).not.toHaveValue("", {
      timeout: 10_000,
    });
    await expect(page.getByTestId("post-slug-input")).toHaveValue(draftSlug);
    await expect(page.getByTestId("post-publish-toggle")).toHaveText(
      /^Publish$/,
    );

    // Edit title and save → redirects to read view at the SAME slug
    const newTitle = `${Date.now()} edited`;
    await page.getByTestId("post-title-input").fill(newTitle);
    await page.getByTestId("save-post-btn").click();

    await expect(page).toHaveURL(
      new RegExp(`/@${username}/posts/${draftSlug}$`),
      { timeout: 15_000 },
    );

    // Round-trip: re-open the editor and verify title persisted.
    await page.goto(`/@${username}/posts/${draftSlug}/edit`, {
      waitUntil: "domcontentloaded",
    });
    await waitForAuthReady(page);
    await expect(page.getByTestId("post-title-input")).toHaveValue(newTitle, {
      timeout: 10_000,
    });
  });
});

test.describe("Post editor — slug uniqueness", () => {
  test("creating with a conflicting slug shows a toast and keeps editor mounted", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    const { draftSlug } = await ensureTestPostFixtures();

    await page.goto(`/@${username}/posts/new`, {
      waitUntil: "domcontentloaded",
    });
    await waitForAuthReady(page);

    await page.getByTestId("post-title-input").fill("Conflict test");
    await page.getByTestId("post-category-input").fill("Notes");
    await page.getByTestId("post-slug-input").fill(draftSlug);

    await page.getByTestId("save-post-btn").click();

    await expect(
      page.getByText(/slug.*(already|exists|taken)/i),
    ).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(new RegExp(`/@${username}/posts/new$`));
    await expect(page.getByTestId("post-title-input")).toHaveValue(
      "Conflict test",
    );
  });
});
