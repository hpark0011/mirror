// PLAN_010 — Tier-5 hard verification for the cover-video flow.
//
// Covers the deterministic surface (picker accept attribute, initial
// state) plus a real-upload happy path that exercises:
//   - the upload pipeline (parallel video + poster upload, ownership
//     claim with server-side MIME + size guard)
//   - the form-state commit hooks (handleCoverUpload mutual exclusion)
//   - the detail-page render (autoPlay/loop/muted/playsInline +
//     `media-src` CSP allowing `*.convex.cloud`)
//
// The MP4 fixture is intentionally tiny and committed under
// `apps/mirror/e2e/fixtures/` so the upload tests run in CI.
import { test, expect, waitForAuthReady } from "./fixtures/auth";
import { ensureTestArticleFixtures } from "./fixtures/article-fixtures";
import path from "path";

const username = "test-user";

const COVER_VIDEO_FIXTURE = path.resolve(
  __dirname,
  "fixtures/cover-video.mp4",
);

test.describe("Article cover video picker (PLAN_010)", () => {
  test("picker exposes a file input that accepts video/mp4 alongside images", async ({
    authenticatedPage: page,
  }) => {
    const { draftSlug } = await ensureTestArticleFixtures({
      key: "cover-video-accept",
    });
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`/@${username}/articles/${draftSlug}/edit`, {
      waitUntil: "domcontentloaded",
    });
    await waitForAuthReady(page);

    const fileInput = page
      .getByTestId("article-cover-image-picker")
      .locator('input[type="file"]');
    await expect(fileInput).toHaveCount(1);
    const accept = await fileInput.getAttribute("accept");
    // The accept attribute is the load-bearing client guard for which
    // files the OS picker offers. Both image/* and video/mp4 must be
    // present so authors can choose either kind from a single picker.
    expect(accept).toContain("image/png");
    expect(accept).toContain("image/jpeg");
    expect(accept).toContain("image/webp");
    expect(accept).toContain("video/mp4");
  });

  test("upload state attribute starts at idle on a fresh fixture article", async ({
    authenticatedPage: page,
  }) => {
    const { draftSlug } = await ensureTestArticleFixtures({
      key: "cover-video-state",
    });
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`/@${username}/articles/${draftSlug}/edit`, {
      waitUntil: "domcontentloaded",
    });
    await waitForAuthReady(page);

    const picker = page.getByTestId("article-cover-image-picker");
    await expect(picker).toHaveAttribute("data-cover-upload-state", "idle");
  });

  test("happy path: upload MP4 → save → detail page renders <video autoPlay loop muted playsInline>", async ({
    authenticatedPage: page,
  }) => {
    // The fixture traverses the network twice (video + poster). 90s
    // gives ample headroom for slow links.
    test.setTimeout(90_000);

    const { draftSlug } = await ensureTestArticleFixtures({
      key: "cover-video-happy",
    });
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`/@${username}/articles/${draftSlug}/edit`, {
      waitUntil: "domcontentloaded",
    });
    await waitForAuthReady(page);

    const fileInput = page
      .getByTestId("article-cover-image-picker")
      .locator('input[type="file"]');

    // Upload kicks off two parallel POSTs to /api/storage/upload (the
    // video and the auto-extracted JPEG poster). `data-cover-upload-state`
    // flips to "ready" only AFTER both upload + ownership-claim mutations
    // settle, which is the deterministic synchronization point per the
    // verification rules.
    await fileInput.setInputFiles(COVER_VIDEO_FIXTURE);
    await page
      .locator("[data-cover-upload-state='ready']")
      .waitFor({ state: "attached", timeout: 60_000 });

    // The picker preview swaps to <video>; assert the local-blob preview
    // is wired up before we save.
    const preview = page.getByTestId("article-cover-video-preview");
    await expect(preview).toBeVisible();

    await page.getByTestId("save-article-btn").click();
    // Edit-form save navigates to the read view on success.
    await expect(page).toHaveURL(
      new RegExp(`/@${username}/articles/${draftSlug}$`),
      { timeout: 15_000 },
    );

    // Detail page must render the video with the four required
    // attributes. Use a network wait on the video src to surface a CSP
    // `media-src` regression as a failed network response.
    const videoResponse = page.waitForResponse(
      (resp) =>
        /\.convex\.(cloud|site)\/.*storage/.test(resp.url()) &&
        resp.status() === 200,
      { timeout: 15_000 },
    );

    const cover = page.getByTestId("article-detail-cover-video");
    await expect(cover).toBeVisible({ timeout: 10_000 });
    await expect(cover).toHaveJSProperty("autoplay", true);
    await expect(cover).toHaveJSProperty("loop", true);
    await expect(cover).toHaveJSProperty("muted", true);
    await expect(cover).toHaveJSProperty("playsInline", true);

    await videoResponse;
    const src = await cover.getAttribute("src");
    expect(src).toMatch(/convex\.(cloud|site)/);
  });

  // Reproduces the bug report: "uploaded an MP4 on /articles/new, see
  // it in preview, save, but the saved article doesn't show it." The
  // /new flow uses `articles.mutations.create` and `router.replace`s
  // to /edit on success — different code path from the /edit happy
  // path above, which uses `update` and navigates to /detail.
  test("create flow: /new → upload MP4 → save → /edit page rehydrates with the video preview", async ({
    authenticatedPage: page,
  }) => {
    test.setTimeout(120_000);

    // Unique slug per run so re-running doesn't hit the
    // "slug already exists" reject path.
    const slug = `cover-video-create-${Date.now()}`;
    const title = `Cover video create ${Date.now()}`;

    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`/@${username}/articles/new`, {
      waitUntil: "domcontentloaded",
    });
    await waitForAuthReady(page);

    await page.getByTestId("article-title-input").fill(title);
    await page.getByTestId("article-slug-input").fill(slug);
    await page.getByTestId("article-category-input").fill("Test");

    const fileInput = page
      .getByTestId("article-cover-image-picker")
      .locator('input[type="file"]');
    await fileInput.setInputFiles(COVER_VIDEO_FIXTURE);
    await page
      .locator("[data-cover-upload-state='ready']")
      .waitFor({ state: "attached", timeout: 60_000 });

    // Preview is the local blob: <video>. Wait for it before saving so
    // the save-click happens after form state has committed both
    // storage ids.
    await expect(
      page.getByTestId("article-cover-video-preview"),
    ).toBeVisible();

    await page.getByTestId("save-article-btn").click();
    // /new redirects to /<slug>/edit on success.
    await expect(page).toHaveURL(
      new RegExp(`/@${username}/articles/${slug}/edit$`),
      { timeout: 15_000 },
    );

    // The /edit page rehydrates the editor from `getBySlug`. The
    // picker MUST show the saved video — otherwise the user sees
    // "Add Cover" and rightly reports the upload as lost.
    const previewAfterSave = page.getByTestId(
      "article-cover-video-preview",
    );
    await expect(previewAfterSave).toBeVisible({ timeout: 10_000 });
    const previewSrc = await previewAfterSave.getAttribute("src");
    expect(previewSrc).toMatch(/convex\.(cloud|site)/);

    // Now navigate to the read view and confirm the detail-page
    // video element is also wired up.
    await page.goto(`/@${username}/articles/${slug}`, {
      waitUntil: "domcontentloaded",
    });
    await waitForAuthReady(page);
    const detailVideo = page.getByTestId("article-detail-cover-video");
    await expect(detailVideo).toBeVisible({ timeout: 10_000 });
  });
});
