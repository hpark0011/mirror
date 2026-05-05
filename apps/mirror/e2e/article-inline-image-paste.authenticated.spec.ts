import { test, expect, waitForAuthReady } from "./fixtures/auth";
import { ensureTestArticleFixtures } from "./fixtures/article-fixtures";
import path from "path";
import fs from "fs";

const username = "test-user";
const FIXTURE_KEY = "paste";

// FG_154: ProseMirror auto-injects `<img class="ProseMirror-separator">` into
// empty inline-level positions to keep the cursor addressable. Use this
// selector for any in-editor image lookup so separators don't shadow the
// real inserted image.
const INSERTED_IMG = "img:not(.ProseMirror-separator)";

// 1x1 red PNG. Smallest valid PNG that satisfies the PNG MIME sniff and the
// inline image upload's PNG/JPEG/WEBP filter.
const TINY_RED_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==";

function writeTempPng(name: string): string {
  const tmpDir = path.join(__dirname, ".tmp");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const filePath = path.join(tmpDir, name);
  fs.writeFileSync(filePath, Buffer.from(TINY_RED_PNG_BASE64, "base64"));
  return filePath;
}

test.describe("Article inline image paste (authenticated)", () => {
  test("article edit page mounts the rich-text editor", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    const { draftSlug } = await ensureTestArticleFixtures({ key: FIXTURE_KEY });
    await page.goto(`/@${username}/articles/${draftSlug}/edit`, {
      waitUntil: "domcontentloaded",
    });

    // The editor wrapper renders even before Tiptap finishes mounting (there's
    // a placeholder div with the same class). Once the editor is live, the
    // ProseMirror contenteditable element appears inside the wrapper.
    await expect(page.locator(".tiptap-content")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.locator(".tiptap-content .ProseMirror")).toBeVisible({
      timeout: 10_000,
    });

    // Save button is rendered by the editor shell.
    await expect(page.getByTestId("save-article-btn")).toBeVisible();
  });

  // FR-01/02/03 — paste a PNG, the inline-image upload pipeline runs,
  // the editor renders the Convex-served URL, and `update` persists the
  // node on save. The previous Convex client-auth race is now resolved
  // by `waitForAuthReady(page)` (see fixtures/auth.ts).
  test(
    "paste a PNG into the editor renders inline and persists on save",
    async ({ authenticatedPage: page }) => {
      await page.setViewportSize({ width: 1440, height: 960 });
      const { draftSlug } = await ensureTestArticleFixtures({ key: FIXTURE_KEY });
      await page.goto(`/@${username}/articles/${draftSlug}/edit`, {
        waitUntil: "domcontentloaded",
      });
      await waitForAuthReady(page);

      const editor = page.locator(".tiptap-content .ProseMirror");
      await expect(editor).toBeVisible({ timeout: 10_000 });
      await editor.click();

      // Synthesize a clipboard paste event with the PNG file. Headless
      // Chromium honors a constructed ClipboardEvent with a DataTransfer that
      // carries `files`; the inline-image upload plugin reads
      // `event.clipboardData.files`.
      const png = writeTempPng("paste-article.png");
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

      // Inline image node renders with a Convex-served URL.
      const insertedImg = editor.locator(INSERTED_IMG).first();
      await expect(insertedImg).toBeVisible({ timeout: 15_000 });
      await expect(insertedImg).toHaveAttribute(
        "src",
        /\.convex\.(cloud|site)\//,
      );

      await page.getByTestId("save-article-btn").click();

      // After save the editor navigates back to the read view; the saved body
      // contains the same image node.
      await page.waitForURL(`**/@${username}/articles/${draftSlug}`, {
        timeout: 15_000,
      });
      await expect(page.locator("img").first()).toBeVisible();
    },
  );
});
