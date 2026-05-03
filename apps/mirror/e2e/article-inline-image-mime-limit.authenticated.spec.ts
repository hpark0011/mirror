import { test, expect } from "./fixtures/auth";
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

// Tiny GIF89a — minimal valid GIF that satisfies the `image/gif` MIME sniff
// but trips the inline upload's allowed-MIME guard (PNG/JPEG/WEBP only).
function writeTempGif(name: string): string {
  const tmpDir = path.join(__dirname, ".tmp");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const filePath = path.join(tmpDir, name);
  // 26-byte GIF89a "1x1 transparent" image.
  const bytes = Buffer.from([
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61, // "GIF89a"
    0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00,
    0x00, 0x00, 0x00, 0xff, 0xff, 0xff,
    0x21, 0xf9, 0x04, 0x01, 0x00, 0x00, 0x00,
    0x00, 0x2c, 0x00, 0x00, 0x00, 0x00,
    0x01, 0x00, 0x01, 0x00, 0x00, 0x02,
    0x02, 0x44, 0x01, 0x00, 0x3b,
  ]);
  fs.writeFileSync(filePath, bytes);
  return filePath;
}

test.describe("Article inline image MIME limit (authenticated)", () => {
  test("article edit page mounts and exposes the editor", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    const { draftSlug } = await ensureTestArticleFixtures();
    await page.goto(`/@${username}/articles/${draftSlug}/edit`, {
      waitUntil: "domcontentloaded",
    });

    await expect(page.locator(".tiptap-content .ProseMirror")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("paste of a GIF triggers the MIME guard before any Convex call", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    const { draftSlug } = await ensureTestArticleFixtures();

    const uploadErrors: string[] = [];
    page.on("console", (msg) => {
      if (
        msg.type() === "error" &&
        msg.text().includes("[inline-image-upload-plugin] upload failed")
      ) {
        uploadErrors.push(msg.text());
      }
    });

    const convexCalls: string[] = [];
    page.on("request", (req) => {
      const url = req.url();
      if (
        url.includes("generateArticleInlineImageUploadUrl") ||
        url.includes("/api/mutation")
      ) {
        convexCalls.push(url);
      }
    });

    await page.goto(`/@${username}/articles/${draftSlug}/edit`, {
      waitUntil: "domcontentloaded",
    });

    const editor = page.locator(".tiptap-content .ProseMirror");
    await expect(editor).toBeVisible({ timeout: 10_000 });
    await editor.click();

    const gif = writeTempGif("disallowed.gif");
    const gifBytes = fs.readFileSync(gif).toString("base64");
    const baselineCalls = convexCalls.length;

    await page.evaluate(async (b64: string) => {
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: "image/gif" });
      const file = new File([blob], "disallowed.gif", { type: "image/gif" });
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
    }, gifBytes);

    await expect
      .poll(() => uploadErrors.length, { timeout: 5_000 })
      .toBeGreaterThan(0);
    expect(uploadErrors.join(" ")).toMatch(/PNG|JPEG|WEBP|mime/i);

    await expect(editor.locator("img")).toHaveCount(0);

    const newConvexCalls = convexCalls.slice(baselineCalls);
    expect(
      newConvexCalls.filter((u) =>
        u.includes("generateArticleInlineImageUploadUrl"),
      ),
    ).toHaveLength(0);
  });
});
