import { test, expect, waitForAuthReady } from "./fixtures/auth";
import path from "path";
import fs from "fs";

const username = "test-user"; // matches ensureTestUser's username

// 1x1 red PNG — smallest valid PNG that satisfies the MIME sniff.
const TINY_RED_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==";

function writeTempPng(name: string): string {
  const tmpDir = path.join(__dirname, ".tmp");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const filePath = path.join(tmpDir, name);
  fs.writeFileSync(filePath, Buffer.from(TINY_RED_PNG_BASE64, "base64"));
  return filePath;
}

function writeTempBlob(name: string, content: Buffer): string {
  const tmpDir = path.join(__dirname, ".tmp");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const filePath = path.join(tmpDir, name);
  fs.writeFileSync(filePath, content);
  return filePath;
}

test.describe("Post cover picker (authenticated)", () => {
  test("cover picker renders inside the new-post editor with the expected accept attr", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`/@${username}/posts/new`, {
      waitUntil: "domcontentloaded",
    });
    await waitForAuthReady(page);

    const picker = page.getByTestId("post-cover-image-picker");
    await expect(picker).toBeVisible({ timeout: 10_000 });

    const fileInput = picker.locator('input[type="file"]');
    await expect(fileInput).toHaveAttribute(
      "accept",
      /image\/png/,
    );
    // Cover picker accepts both image and video.
    await expect(fileInput).toHaveAttribute("accept", /video\/mp4/);
  });

  test("rejects a non-image cover file with an error", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`/@${username}/posts/new`, {
      waitUntil: "domcontentloaded",
    });
    await waitForAuthReady(page);

    const picker = page.getByTestId("post-cover-image-picker");
    await expect(picker).toBeVisible({ timeout: 10_000 });

    // .txt file masquerading as a cover image → upload pipeline rejects on MIME.
    const bogus = writeTempBlob("not-an-image.txt", Buffer.from("hello"));
    await picker.locator('input[type="file"]').setInputFiles(bogus);

    // No preview when invalid (the picker reverts to its add-cover state).
    await expect(picker.locator("img")).toHaveCount(0);
  });

  test("valid PNG cover shows preview in the editor", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`/@${username}/posts/new`, {
      waitUntil: "domcontentloaded",
    });
    await waitForAuthReady(page);

    const picker = page.getByTestId("post-cover-image-picker");
    await expect(picker).toBeVisible({ timeout: 10_000 });

    const png = writeTempPng("cover.png");
    await picker.locator('input[type="file"]').setInputFiles(png);

    const preview = picker.locator("img");
    await expect(preview).toBeVisible({ timeout: 10_000 });
    // Local blob URL while upload is in flight, then Convex signed URL.
    await expect(preview).toHaveAttribute(
      "src",
      /^blob:|\.convex\.(cloud|site)\//,
    );
  });
});
