import { test, expect, waitForAuthReady } from "./fixtures/auth";
import { requireEnv } from "./lib/env";
import path from "path";
import fs from "fs";

const username = "test-user";
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

const TINY_RED_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==";

function writeTempPng(name: string): string {
  const tmpDir = path.join(__dirname, ".tmp");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const filePath = path.join(tmpDir, name);
  fs.writeFileSync(filePath, Buffer.from(TINY_RED_PNG_BASE64, "base64"));
  return filePath;
}

test.describe("Post inline image paste (authenticated)", () => {
  test("post edit page mounts the rich-text editor", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    const { draftSlug } = await ensureTestPostFixtures();
    await page.goto(`/@${username}/posts/${draftSlug}/edit`, {
      waitUntil: "domcontentloaded",
    });

    await expect(page.locator(".tiptap-content")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.locator(".tiptap-content .ProseMirror")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId("save-post-btn")).toBeVisible();
  });

  // FR-01/02/03 mirror on the posts surface. Auth race resolved by
  // `waitForAuthReady(page)`.
  test(
    "paste a PNG into the post editor renders inline and persists on save",
    async ({ authenticatedPage: page }) => {
      await page.setViewportSize({ width: 1440, height: 960 });
      const { draftSlug } = await ensureTestPostFixtures();
      await page.goto(`/@${username}/posts/${draftSlug}/edit`, {
        waitUntil: "domcontentloaded",
      });
      await waitForAuthReady(page);

      const editor = page.locator(".tiptap-content .ProseMirror");
      await expect(editor).toBeVisible({ timeout: 10_000 });
      await editor.click();

      const png = writeTempPng("paste-post.png");
      const pngBytes = fs.readFileSync(png).toString("base64");
      await page.evaluate(async (b64: string) => {
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const blob = new Blob([bytes], { type: "image/png" });
        const file = new File([blob], "pasted.png", { type: "image/png" });
        const dt = new DataTransfer();
        dt.items.add(file);
        const target = document.querySelector(
          ".tiptap-content .ProseMirror",
        ) as HTMLElement | null;
        if (!target) throw new Error("ProseMirror editor not found");
        target.focus();
        target.dispatchEvent(
          new ClipboardEvent("paste", {
            clipboardData: dt,
            bubbles: true,
            cancelable: true,
          }),
        );
      }, pngBytes);

      const insertedImg = editor.locator("img").first();
      await expect(insertedImg).toBeVisible({ timeout: 15_000 });
      await expect(insertedImg).toHaveAttribute(
        "src",
        /\.convex\.(cloud|site)\//,
      );

      await page.getByTestId("save-post-btn").click();
      await page.waitForURL(`**/@${username}/posts/${draftSlug}`, {
        timeout: 15_000,
      });
      await expect(page.locator("img").first()).toBeVisible();
    },
  );
});
