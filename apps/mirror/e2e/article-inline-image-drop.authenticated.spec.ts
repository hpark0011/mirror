import { test, expect, waitForAuthReady } from "./fixtures/auth";
import { requireEnv } from "./lib/env";
import path from "path";
import fs from "fs";

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

// 26-byte WEBP file header — minimal "valid" WEBP that satisfies the
// `image/webp` MIME sniff and the inline-image-upload's WEBP filter.
// Built from: RIFF (4) + size (4) + WEBP (4) + VP8L (4) + size (4) + 0x2f + 6 bytes payload.
function writeTempWebp(name: string): string {
  const tmpDir = path.join(__dirname, ".tmp");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const filePath = path.join(tmpDir, name);
  // Tiny VP8L WEBP. Encodes a 1x1 image.
  const bytes = Buffer.from([
    0x52, 0x49, 0x46, 0x46, // "RIFF"
    0x1a, 0x00, 0x00, 0x00, // file size - 8 = 26
    0x57, 0x45, 0x42, 0x50, // "WEBP"
    0x56, 0x50, 0x38, 0x4c, // "VP8L"
    0x0d, 0x00, 0x00, 0x00, // chunk size = 13
    0x2f, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  ]);
  fs.writeFileSync(filePath, bytes);
  return filePath;
}

test.describe("Article inline image drop (authenticated)", () => {
  test("article edit page accepts focus on the editor surface", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    const { draftSlug } = await ensureTestArticleFixtures();
    await page.goto(`/@${username}/articles/${draftSlug}/edit`, {
      waitUntil: "domcontentloaded",
    });

    const editor = page.locator(".tiptap-content .ProseMirror");
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // Click into the editor and confirm it accepts text (cheap proof that
    // Tiptap's contenteditable is wired up; covers everything before the
    // upload-mutation auth race).
    await editor.click();
    await page.keyboard.type("hello drop");
    await expect(editor).toContainText("hello drop");
  });

  // FR-01/02/03 (drop variant). Synthesizes a drop event carrying a WEBP and
  // asserts the inline-image upload pipeline + save round-trip. The previous
  // Convex client-auth race is now resolved by `waitForAuthReady(page)`.
  test(
    "drop a WEBP onto the editor inserts the image node",
    async ({ authenticatedPage: page }) => {
      await page.setViewportSize({ width: 1440, height: 960 });
      const { draftSlug } = await ensureTestArticleFixtures();
      await page.goto(`/@${username}/articles/${draftSlug}/edit`, {
        waitUntil: "domcontentloaded",
      });
      await waitForAuthReady(page);

      const editor = page.locator(".tiptap-content .ProseMirror");
      await expect(editor).toBeVisible({ timeout: 10_000 });
      await editor.click();

      const webp = writeTempWebp("drop-article.webp");
      const webpBytes = fs.readFileSync(webp).toString("base64");

      // Synthesize a drop event carrying the WEBP. The plugin's `handleDrop`
      // reads `event.dataTransfer.files` and calls `posAtCoords`.
      await page.evaluate(async (b64: string) => {
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const blob = new Blob([bytes], { type: "image/webp" });
        const file = new File([blob], "dropped.webp", { type: "image/webp" });
        const dt = new DataTransfer();
        dt.items.add(file);
        const target = document.querySelector(
          ".tiptap-content .ProseMirror",
        ) as HTMLElement | null;
        if (!target) throw new Error("ProseMirror editor not found");
        const rect = target.getBoundingClientRect();
        const drop = new DragEvent("drop", {
          dataTransfer: dt,
          bubbles: true,
          cancelable: true,
          clientX: rect.left + 10,
          clientY: rect.top + 10,
        });
        target.dispatchEvent(drop);
      }, webpBytes);

      const insertedImg = editor.locator("img").first();
      await expect(insertedImg).toBeVisible({ timeout: 15_000 });
      await expect(insertedImg).toHaveAttribute(
        "src",
        /\.convex\.(cloud|site)\//,
      );

      await page.getByTestId("save-article-btn").click();
      await page.waitForURL(`**/@${username}/articles/${draftSlug}`, {
        timeout: 15_000,
      });
      await expect(page.locator("img").first()).toBeVisible();
    },
  );
});
