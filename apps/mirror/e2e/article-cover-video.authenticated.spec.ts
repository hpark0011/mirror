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
import { requireEnv } from "./lib/env";
import { api } from "@feel-good/convex/convex/_generated/api";
import { type Id } from "@feel-good/convex/convex/_generated/dataModel";
import { MAX_COVER_VIDEO_BYTES } from "@feel-good/convex/convex/content/storagePolicy";
import { ConvexHttpClient } from "convex/browser";
import path from "path";
import fs from "fs";

const username = "test-user";
const convexUrl = requireEnv("NEXT_PUBLIC_CONVEX_URL");
const convexSiteUrl = requireEnv("NEXT_PUBLIC_CONVEX_SITE_URL");
const testSecret = requireEnv("PLAYWRIGHT_TEST_SECRET");

// CI uses the committed tiny MP4. Local/manual runs can point at a
// larger real-world clip, e.g. `COVER_VIDEO_FIXTURE=workspace/artifacts/...`.
const COVER_VIDEO_FIXTURE = path.resolve(
  __dirname,
  process.env.COVER_VIDEO_FIXTURE ?? "fixtures/cover-video.mp4",
);
const AUTH_STATE_FILE = path.resolve(__dirname, ".auth/user.json");
const SMALL_PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06,
  0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44,
  0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0d,
  0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42,
  0x60, 0x82,
]);
const OVERSIZE_MP4_BYTES = MAX_COVER_VIDEO_BYTES + 1024 * 1024;

type StorageState = {
  cookies: Array<{
    name: string;
    value: string;
  }>;
};

type CoverBlobStorageState = {
  storageExists: boolean;
  ownershipExists: boolean;
};

function readConvexJwtFromStorageState(): string {
  const storageState = JSON.parse(
    fs.readFileSync(AUTH_STATE_FILE, "utf8"),
  ) as StorageState;
  const cookie = storageState.cookies.find((c) =>
    c.name.includes("convex_jwt"),
  );
  if (!cookie) {
    throw new Error(`Convex JWT cookie not found in ${AUTH_STATE_FILE}`);
  }
  return cookie.value;
}

function createAuthedConvexClient(): ConvexHttpClient {
  const client = new ConvexHttpClient(convexUrl);
  client.setAuth(readConvexJwtFromStorageState());
  return client;
}

async function uploadBytesToStorage(
  uploadUrl: string,
  bytes: Buffer,
  contentType: string,
): Promise<Id<"_storage">> {
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: new Uint8Array(bytes),
  });
  if (!response.ok) {
    throw new Error(
      `Storage upload failed (${response.status} ${response.statusText}): ${await response.text()}`,
    );
  }
  const { storageId } = (await response.json()) as {
    storageId: Id<"_storage">;
  };
  return storageId;
}

async function readCoverBlobStorageState(
  storageId: Id<"_storage">,
): Promise<CoverBlobStorageState> {
  const response = await fetch(
    `${convexSiteUrl}/test/cover-blob-storage-state`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-test-secret": testSecret,
      },
      body: JSON.stringify({ storageId }),
    },
  );
  if (!response.ok) {
    throw new Error(
      `cover-blob-storage-state failed (${response.status}): ${await response.text()}`,
    );
  }
  return response.json() as Promise<CoverBlobStorageState>;
}

async function expectRejectedBlobCleaned(
  storageId: Id<"_storage">,
): Promise<void> {
  await expect
    .poll(() => readCoverBlobStorageState(storageId), { timeout: 10_000 })
    .toEqual({ storageExists: false, ownershipExists: false });
}

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

  test("claimCoverVideoOwnership rejects a non-MP4 upload and deletes the blob", async () => {
    const client = createAuthedConvexClient();
    const { videoUrl } = await client.mutation(
      api.articles.mutations.generateArticleCoverVideoUploadUrls,
      {},
    );
    const storageId = await uploadBytesToStorage(
      videoUrl,
      SMALL_PNG_BYTES,
      "image/png",
    );

    await expect(
      client.action(api.articles.mutations.claimCoverVideoOwnership, {
        storageId,
      }),
    ).rejects.toThrow(/cover video must be one of/);

    await expectRejectedBlobCleaned(storageId);
  });

  test("claimCoverVideoOwnership rejects an over-25 MiB MP4 and deletes the blob", async () => {
    test.setTimeout(120_000);

    const client = createAuthedConvexClient();
    const { videoUrl } = await client.mutation(
      api.articles.mutations.generateArticleCoverVideoUploadUrls,
      {},
    );
    const mp4Bytes = Buffer.alloc(OVERSIZE_MP4_BYTES);
    Buffer.from([
      0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
      0x00, 0x00, 0x02, 0x00, 0x69, 0x73, 0x6f, 0x6d, 0x69, 0x73, 0x6f, 0x32,
    ]).copy(mp4Bytes, 0);
    const storageId = await uploadBytesToStorage(
      videoUrl,
      mp4Bytes,
      "video/mp4",
    );

    await expect(
      client.action(api.articles.mutations.claimCoverVideoOwnership, {
        storageId,
      }),
    ).rejects.toThrow(/cover video exceeds maximum size/);

    await expectRejectedBlobCleaned(storageId);
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
    await expect(page.getByTestId("article-cover-video-preview")).toBeVisible();

    await page.getByTestId("save-article-btn").click();
    // /new redirects to /<slug>/edit on success.
    await expect(page).toHaveURL(
      new RegExp(`/@${username}/articles/${slug}/edit$`),
      { timeout: 15_000 },
    );

    // The /edit page rehydrates the editor from `getBySlug`. The
    // picker MUST show the saved video — otherwise the user sees
    // "Add Cover" and rightly reports the upload as lost.
    const previewAfterSave = page.getByTestId("article-cover-video-preview");
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
