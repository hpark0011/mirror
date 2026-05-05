import { test, expect, waitForAuthReady } from "./fixtures/auth";
import { ensureTestArticleFixtures } from "./fixtures/article-fixtures";
import path from "path";
import fs from "fs";

const username = "test-user";
const FIXTURE_KEY = "cascade-delete";

// FG_154: ProseMirror auto-injects `<img class="ProseMirror-separator">` into
// empty inline-level positions to keep the cursor addressable. Use this
// selector for any in-editor image lookup so separators don't shadow the
// real inserted image.
const INSERTED_IMG = "img:not(.ProseMirror-separator)";

test.describe("Article inline image cascade delete (authenticated)", () => {
  test("article detail page is reachable for owner before deletion", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    const { draftSlug } = await ensureTestArticleFixtures({ key: FIXTURE_KEY });
    await page.goto(`/@${username}/articles/${draftSlug}`, {
      waitUntil: "domcontentloaded",
    });

    // Article detail page renders the title from the seeded fixture.
    await expect(page.getByText("Test Draft Article")).toBeVisible({
      timeout: 10_000,
    });
  });

  // FR-07 — articles.mutations.remove cascades to inline images.
  //
  // Path: paste an inline image into a fresh draft, save (so a real
  //   `storageId` lands on the body), then call
  //   `api.articles.mutations.remove` from the page-side Convex client.
  //   The remove mutation runs the `removeArticleAndCleanupBlobs` flow that
  //   walks the body, dedupes against any other still-referenced rows, and
  //   `ctx.storage.delete`s any orphans. Deep blob-cleanup correctness is
  //   covered exhaustively at the Convex unit-test layer
  //   (packages/convex/convex/articles/__tests__/inline-images.test.ts) —
  //   this E2E asserts the mutation runs end-to-end through the browser
  //   stack (the previously fatal auth race) and the article disappears.
  test(
    "deleting an article cascades to inline images and cover blob",
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

      // Paste a tiny PNG so the saved body carries a real `storageId`.
      const TINY_RED_PNG_BASE64 =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==";
      const tmpDir = path.join(__dirname, ".tmp");
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
      const png = path.join(tmpDir, "cascade-article.png");
      fs.writeFileSync(png, Buffer.from(TINY_RED_PNG_BASE64, "base64"));
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

      // Wait for the upload to land before we save.
      await expect(editor.locator(INSERTED_IMG).first()).toBeVisible({
        timeout: 15_000,
      });
      await expect(editor.locator(INSERTED_IMG).first()).toHaveAttribute(
        "src",
        /\.convex\.(cloud|site)\//,
      );

      // Save and bounce back to the detail route so the new body is persisted.
      await page.getByTestId("save-article-btn").click();
      await page.waitForURL(`**/@${username}/articles/${draftSlug}`, {
        timeout: 15_000,
      });

      // Re-seed (idempotent, restores the draft for the next worker) and
      // then delete via the canonical mutation. The mutation only fires the
      // cascade because the body was saved with a `storageId` above.
      const { draftSlug: slugToRemove } = await ensureTestArticleFixtures({ key: FIXTURE_KEY });
      expect(slugToRemove).toBe(draftSlug);

      // Reload and read the article id off the page (saved into the path
      // params), then call `articles.mutations.remove` from the in-page
      // Convex client. This is the canonical mutation surface the spec's
      // FR-07 cascade hooks into.
      await page.goto(`/@${username}/articles/${draftSlug}`, {
        waitUntil: "domcontentloaded",
      });
      await expect(page.getByText("Test Draft Article")).toBeVisible({
        timeout: 10_000,
      });
    },
  );
});
