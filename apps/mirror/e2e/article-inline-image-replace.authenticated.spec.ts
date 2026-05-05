import { test, expect, waitForAuthReady } from "./fixtures/auth";
import { ensureTestArticleFixtures } from "./fixtures/article-fixtures";
import path from "path";
import fs from "fs";

const username = "test-user";
const FIXTURE_KEY = "replace";

// FG_154: ProseMirror auto-injects `<img class="ProseMirror-separator">` into
// empty inline-level positions to keep the cursor addressable. After the
// FG_153 plugin change to `tr.insert(insertPos, node)` (correctly auto-splits
// the paragraph), the editor leaves an empty paragraph next to the inserted
// image, which then carries a separator `img`. Counting raw `img` inside
// `.ProseMirror` therefore double-counts. Use this selector for any in-editor
// image-count assertion.
const INSERTED_IMG = "img:not(.ProseMirror-separator)";

test.describe("Article inline image replace / delete-on-save (authenticated)", () => {
  test("article edit page renders for owner and exposes save control", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    const { draftSlug } = await ensureTestArticleFixtures({ key: FIXTURE_KEY });
    await page.goto(`/@${username}/articles/${draftSlug}/edit`, {
      waitUntil: "domcontentloaded",
    });

    await expect(page.locator(".tiptap-content")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId("save-article-btn")).toBeVisible();
  });

  // FR-06 — delete-on-save body diffing. Auth race resolved by
  // `waitForAuthReady`. We seed via the editor (paste twice, save, reload),
  // then delete one image and save, asserting the surviving one persists.
  // Storage-blob cleanup correctness is covered at the Convex unit-test
  // layer (`packages/convex/convex/articles/__tests__/inline-images.test.ts`);
  // this E2E proves the user-facing path runs end-to-end through the
  // browser stack.
  test(
    "delete one of two inline images and save removes only that blob",
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

      // Paste two PNGs back-to-back so the body carries two image nodes.
      const TINY_RED_PNG_BASE64 =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==";
      const tmpDir = path.join(__dirname, ".tmp");
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
      const png = path.join(tmpDir, "replace-article.png");
      fs.writeFileSync(png, Buffer.from(TINY_RED_PNG_BASE64, "base64"));
      const pngBytes = fs.readFileSync(png).toString("base64");

      const pastePng = async () => {
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
      };

      await pastePng();
      await expect(editor.locator(INSERTED_IMG)).toHaveCount(1, { timeout: 15_000 });
      await pastePng();
      await expect(editor.locator(INSERTED_IMG)).toHaveCount(2, { timeout: 15_000 });

      // Save with two images.
      await page.getByTestId("save-article-btn").click();
      await page.waitForURL(`**/@${username}/articles/${draftSlug}`, {
        timeout: 15_000,
      });
      await expect(page.locator("img").first()).toBeVisible();

      // Re-enter the editor and delete the second image.
      await page.goto(`/@${username}/articles/${draftSlug}/edit`, {
        waitUntil: "domcontentloaded",
      });
      await waitForAuthReady(page);
      const editor2 = page.locator(".tiptap-content .ProseMirror");
      await expect(editor2).toBeVisible({ timeout: 10_000 });

      // Two images survive the round-trip.
      await expect(editor2.locator(INSERTED_IMG)).toHaveCount(2, { timeout: 10_000 });

      // Click the second image and remove it (Backspace handles image-node
      // deletion in Tiptap because the image node is selectable).
      const secondImg = editor2.locator(INSERTED_IMG).nth(1);
      await secondImg.click();
      await page.keyboard.press("Backspace");
      await expect(editor2.locator(INSERTED_IMG)).toHaveCount(1, { timeout: 5_000 });

      await page.getByTestId("save-article-btn").click();
      await page.waitForURL(`**/@${username}/articles/${draftSlug}`, {
        timeout: 15_000,
      });

      // Surviving image is still visible on the read view.
      await expect(page.locator("img").first()).toBeVisible();
    },
  );
});
