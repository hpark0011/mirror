import { test, expect } from "./fixtures/auth";
import { ensureTestArticleFixtures } from "./fixtures/article-fixtures";
import path from "path";
import fs from "fs";

const username = "test-user";
const FIXTURE_KEY = "size-limit";

// FG_154: ProseMirror auto-injects `<img class="ProseMirror-separator">` into
// empty inline-level positions. The empty draft this spec opens already has
// a separator, so a raw `img` count would be 1 — not 0 — even when no
// upload fired. Use this selector for any in-editor image-count assertion.
const INSERTED_IMG = "img:not(.ProseMirror-separator)";

// 6 MiB PNG: a real (but oversize) PNG that satisfies the MIME sniff yet
// trips the 5 MiB hook-level size guard before any Convex mutation runs.
// We pad after the IDAT chunk's tEXt with zeros — image is still a valid PNG
// for File.type purposes (MIME is decided by the browser from the first bytes).
function writeTempOversizePng(name: string): string {
  const tmpDir = path.join(__dirname, ".tmp");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const filePath = path.join(tmpDir, name);
  // Start with a valid 1x1 PNG header sequence then pad to >5 MiB. Browsers
  // sniff MIME from the leading bytes, and File.type follows the MIME
  // assigned at construction time — we set image/png explicitly via the
  // page.evaluate() call site, so the byte content here only needs to be
  // > MAX_INLINE_IMAGE_BYTES (= 5 MiB).
  const SIX_MIB = 6 * 1024 * 1024;
  const buf = Buffer.alloc(SIX_MIB);
  // PNG magic so any sniff that reaches the file content still sees a PNG.
  const magic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  magic.copy(buf, 0);
  fs.writeFileSync(filePath, buf);
  return filePath;
}

test.describe("Article inline image size limit (authenticated)", () => {
  test("article edit page mounts and exposes the editor", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    const { draftSlug } = await ensureTestArticleFixtures({ key: FIXTURE_KEY });
    await page.goto(`/@${username}/articles/${draftSlug}/edit`, {
      waitUntil: "domcontentloaded",
    });

    await expect(page.locator(".tiptap-content .ProseMirror")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("paste of a 6 MB PNG triggers the size guard before any Convex call", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    const { draftSlug } = await ensureTestArticleFixtures({ key: FIXTURE_KEY });

    // Capture the inline-image-upload-plugin's console.error so we can
    // assert FR-11 fires synchronously (the hook throws InlineImageValidationError
    // before generateUploadUrl is called).
    const uploadErrors: string[] = [];
    page.on("console", (msg) => {
      if (
        msg.type() === "error" &&
        msg.text().includes("[inline-image-upload-plugin] upload failed")
      ) {
        uploadErrors.push(msg.text());
      }
    });

    // Capture network requests to Convex so we can assert that the upload-URL
    // mutation never fired (the size guard rejects before reaching Convex).
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

    const oversize = writeTempOversizePng("oversize-article.png");
    const oversizeBytes = fs.readFileSync(oversize).toString("base64");
    const baselineCalls = convexCalls.length;

    await page.evaluate(async (b64: string) => {
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: "image/png" });
      const file = new File([blob], "oversize.png", { type: "image/png" });
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
    }, oversizeBytes);

    // Wait for the plugin to log its rejection. The hook validates synchronously
    // before any Convex round-trip, so the error surfaces almost immediately.
    await expect
      .poll(() => uploadErrors.length, { timeout: 5_000 })
      .toBeGreaterThan(0);
    expect(uploadErrors.join(" ")).toMatch(/smaller than 5 MB|size/i);

    // No image node was inserted into the editor.
    await expect(editor.locator(INSERTED_IMG)).toHaveCount(0);

    // No `generateArticleInlineImageUploadUrl` mutation request fired.
    const newConvexCalls = convexCalls.slice(baselineCalls);
    expect(
      newConvexCalls.filter((u) =>
        u.includes("generateArticleInlineImageUploadUrl"),
      ),
    ).toHaveLength(0);
  });
});
