import { test, expect, waitForAuthReady } from "./fixtures/auth";
import path from "path";
import fs from "fs";
import sharp from "sharp";

const username = "test-user";

const TINY_RED_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==";

async function writeLargerTempPng(name: string): Promise<string> {
  // A 64×64 PNG with a recognisable gradient — large enough for
  // thumbhash's 7×7 DCT to produce a non-empty hash. The existing 1×1
  // fixture is fine for cover-render tests but too small for the
  // thumbhash encoder, which needs at least ~5px on a side.
  const tmpDir = path.join(__dirname, ".tmp");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const filePath = path.join(tmpDir, name);
  const buf = await sharp({
    create: {
      width: 64,
      height: 64,
      channels: 4,
      background: { r: 200, g: 80, b: 40, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
  fs.writeFileSync(filePath, buf);
  return filePath;
}

function writeTempPng(name: string): string {
  const tmpDir = path.join(__dirname, ".tmp");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const filePath = path.join(tmpDir, name);
  fs.writeFileSync(filePath, Buffer.from(TINY_RED_PNG_BASE64, "base64"));
  return filePath;
}

test("article detail page renders the cover image below the title", async ({
  authenticatedPage: page,
}) => {
  await page.setViewportSize({ width: 1440, height: 960 });

  const slug = `detail-cover-${Date.now()}`;
  const title = `Detail cover ${Date.now()}`;
  await page.goto(`/@${username}/articles/new`, { waitUntil: "domcontentloaded" });
  await waitForAuthReady(page);
  await page.getByTestId("article-title-input").fill(title);
  await page.getByTestId("article-slug-input").fill(slug);
  await page.getByTestId("article-category-input").fill("Process");

  const png = writeTempPng(`detail-cover-${Date.now()}.png`);
  const fileInput = page
    .getByTestId("article-cover-image-picker")
    .locator('input[type="file"]');
  // The picker shows a local blob preview synchronously before the upload
  // completes; wait for the actual storage POST so setCoverImageStorageId
  // has run in form state before we click save.
  const uploadDone = page.waitForResponse(
    (resp) =>
      resp.request().method() === "POST" &&
      resp.url().includes("/api/storage/upload"),
    { timeout: 15_000 },
  );
  await fileInput.setInputFiles(png);
  await uploadDone;
  // waitForResponse resolves when the HTTP response arrives, before the
  // browser-side handler parses { storageId } and React flushes
  // setCoverImageStorageId. A short settle covers that microtask chain.
  await page.waitForTimeout(500);

  await page.getByTestId("save-article-btn").click();
  await expect(page).toHaveURL(
    new RegExp(`/@${username}/articles/${slug}/edit$`),
    { timeout: 15_000 },
  );

  // Owner can view their own draft on the detail route — no publish needed.
  await page.goto(`/@${username}/articles/${slug}`, {
    waitUntil: "domcontentloaded",
  });
  await waitForAuthReady(page);

  const heading = page.getByRole("heading", { level: 1, name: title });
  await expect(heading).toBeVisible({ timeout: 10_000 });

  const cover = page.getByTestId("article-detail-cover-image");
  await expect(cover).toBeVisible({ timeout: 10_000 });
  // next/image rewrites src to `/_next/image?url=<encoded>` — match the
  // encoded form (no trailing `/` since the path separator is URL-encoded).
  await expect(cover).toHaveAttribute("src", /convex\.(cloud|site)/);

  const orderingOk = await page.evaluate(() => {
    const h1 = document.querySelector("h1");
    const img = document.querySelector(
      '[data-testid="article-detail-cover-image"]',
    );
    if (!h1 || !img) return false;
    return Boolean(
      h1.compareDocumentPosition(img) & Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });
  expect(orderingOk).toBe(true);
});

test("article detail page renders a thumbhash blur placeholder", async ({
  authenticatedPage: page,
}) => {
  await page.setViewportSize({ width: 1440, height: 960 });

  const slug = `detail-blur-${Date.now()}`;
  const title = `Detail blur ${Date.now()}`;
  await page.goto(`/@${username}/articles/new`, { waitUntil: "domcontentloaded" });
  await waitForAuthReady(page);
  await page.getByTestId("article-title-input").fill(title);
  await page.getByTestId("article-slug-input").fill(slug);
  await page.getByTestId("article-category-input").fill("Process");

  const png = await writeLargerTempPng(`detail-blur-${Date.now()}.png`);
  const fileInput = page
    .getByTestId("article-cover-image-picker")
    .locator('input[type="file"]');
  const uploadDone = page.waitForResponse(
    (resp) =>
      resp.request().method() === "POST" &&
      resp.url().includes("/api/storage/upload"),
    { timeout: 15_000 },
  );
  await fileInput.setInputFiles(png);
  await uploadDone;
  // Wait for the upload Promise.all to settle and React to flush both
  // setters before saving — deterministic, replaces a 500ms heuristic.
  await page
    .locator("[data-cover-upload-state='ready']")
    .waitFor({ state: "attached", timeout: 15_000 });

  await page.getByTestId("save-article-btn").click();
  await expect(page).toHaveURL(
    new RegExp(`/@${username}/articles/${slug}/edit$`),
    { timeout: 15_000 },
  );

  await page.goto(`/@${username}/articles/${slug}`, {
    waitUntil: "domcontentloaded",
  });
  await waitForAuthReady(page);

  const heading = page.getByRole("heading", { level: 1, name: title });
  await expect(heading).toBeVisible({ timeout: 10_000 });

  // The wrapper around the cover Image carries the raw base64 thumbhash as
  // a data attribute. It is the deterministic test surface — present in the
  // DOM regardless of image-load state, unlike next/image's inline blur
  // style (which strips after load).
  const wrapper = page.locator("[data-cover-thumbhash]").first();
  await expect(wrapper).toBeVisible({ timeout: 10_000 });

  const thumbhash = await wrapper.getAttribute("data-cover-thumbhash");
  expect(thumbhash).toBeTruthy();
  expect(thumbhash!.length).toBeGreaterThan(10);

  // Confirm the cover Image still resolves to a Convex storage URL — i.e.
  // the placeholder wiring didn't break the actual src.
  const cover = page.getByTestId("article-detail-cover-image");
  await expect(cover).toHaveAttribute("src", /convex\.(cloud|site)/);
});
