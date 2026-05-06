# Plan: Render cover image in article detail view

**Branch**: `feature-article-cover-image`
**Worktree**: `.worktrees/feature-article-cover-image/`
**Date**: 2026-05-06

## Problem

Authors can already upload a cover image to an article via the editor's metadata header (`article-metadata-header.tsx` → `CoverImagePicker`). The image is persisted as `coverImageStorageId` on the `articles` row and surfaced as `coverImageUrl` by `api.articles.queries.getBySlug`. The list query `getByUsername` also returns it.

The article **detail** page (`apps/mirror/features/articles/components/detail/article-detail.tsx`) renders the title and body but never references `article.coverImageUrl`, so readers do not see the cover image. The post-detail view already renders covers (`apps/mirror/features/posts/components/post-detail.tsx:35-46`) — that's the pattern we are mirroring.

## Goal

When `ArticleDetail` is rendered with an article that has a non-null `coverImageUrl`, display the image **below the title** and above the body.

## Non-goals

- **No backend changes.** `coverImageUrl` is already on `ArticleWithBody` (`apps/mirror/features/articles/types.ts:10`) and resolved server-side in `getBySlug` (`packages/convex/convex/articles/queries.ts:103-106`). No schema, validator, query, or mutation change is needed.
- **No editor changes.** Upload, clear, and persistence already work end-to-end (covered by `e2e/article-editor.authenticated.spec.ts` "cover image upload renders preview and persists storageId on save").
- **No list-item change.** This plan does not touch the article list item (separate concern even though `coverImageUrl` is also returned by `getByUsername`).
- **No new design tokens or animations.** Match the post-detail visual treatment so the two readers feel consistent.

## Current state

| Concern | Where | State |
| --- | --- | --- |
| Schema field | `packages/convex/convex/articles/schema.ts` (`coverImageStorageId`) | Already present |
| Query resolution | `packages/convex/convex/articles/queries.ts:103-106` & `:143` | Returns `coverImageUrl: string \| null` |
| Type | `apps/mirror/features/articles/types.ts:10` | `coverImageUrl: string \| null` on `ArticleSummary`, inherited by `ArticleWithBody` |
| Detail rendering | `apps/mirror/features/articles/components/detail/article-detail.tsx` | **Does not render the cover image** — the bug |
| Reference impl | `apps/mirror/features/posts/components/post-detail.tsx:35-46` | Already renders post cover with `next/image` |
| `next.config.ts` `images.remotePatterns` | `apps/mirror/next.config.ts:18-32` | Already allows `*.convex.cloud` and `*.convex.site` |
| CSP `img-src` | `apps/mirror/next.config.ts:8` | Already allows `https://*.convex.cloud https://*.convex.site` |

## Approach

Render `next/image` between the title `<h1>` and the `<RichTextViewer>` only when `article.coverImageUrl` is truthy. Match the post-detail aspect/rounding so the design language stays consistent: `aspect-video`, `rounded-xl`, `object-cover`, `[corner-shape:superellipse(1.3)]`.

The detail layout differs from post-detail (centered max-w-xl column instead of two-column) so we cannot copy the wrapper unchanged — but we can copy the inner image wrapper and slot it inside the existing `<article>`.

Position relative to title: the title currently has `mb-14`; we keep the rhythm by giving the cover image `mb-14` and dropping the title's `mb-14` to a smaller value (e.g. `mb-7`) so title→image→body spacing remains visually balanced. Confirm with screenshot before declaring done.

## Implementation steps

1. **Edit `apps/mirror/features/articles/components/detail/article-detail.tsx`:**
   - Add `import Image from "next/image";` next to the other imports.
   - When `article.coverImageUrl` is truthy, render between the `<h1>` and `<RichTextViewer>`:
     ```tsx
     {article.coverImageUrl && (
       <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-background-subtle [corner-shape:superellipse(1.3)] mb-14">
         <Image
           src={article.coverImageUrl}
           alt=""
           fill
           sizes="(min-width: 768px) 36rem, 100vw"
           priority
           className="object-cover"
           data-testid="article-detail-cover-image"
         />
       </div>
     )}
     ```
   - Adjust the title's `mb-14` → `mb-7` so total title → body whitespace stays close to today when no cover image is present, and is balanced by the image's own bottom margin when one is present. (Tweak via screenshot.)
   - Keep `alt=""` because the title is the accessible name for the article; the cover is decorative. (Same convention used by post-detail.)
   - Add `data-testid="article-detail-cover-image"` so the e2e test can target it deterministically.

2. **Verify no other callers depend on the old class shape.** Grep for `article-detail` and confirm only the page route renders it. The component has no other consumers.

3. **Run Tier 3 verification** (CSS / visual change touching layout):
   ```bash
   pnpm build --filter=@feel-good/mirror
   pnpm lint --filter=@feel-good/mirror
   ```
   Then use Chrome MCP to screenshot `/@test-user/articles/<slug-with-cover>` and confirm the image appears below the title with no layout breakage.

## Hard verification (Playwright CLI)

Per `.claude/rules/verification.md` § E2E Tests, hard verification uses the Playwright CLI — never Playwright MCP.

**New test**: `apps/mirror/e2e/article-detail-cover-image.authenticated.spec.ts`

This spec authors a draft article via the UI (which already works in `article-editor.authenticated.spec.ts`'s "cover image upload renders preview and persists storageId on save" test), publishes it, navigates to the public detail URL, and asserts the cover image renders.

```ts
import { test, expect } from "./fixtures/auth";
import path from "path";
import fs from "fs";

const username = "test-user";

const TINY_RED_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==";

function writeTempPng(name: string): string {
  const tmpDir = path.join(__dirname, ".tmp");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const filePath = path.join(tmpDir, name);
  fs.writeFileSync(filePath, Buffer.from(TINY_RED_PNG_BASE64, "base64"));
  return filePath;
}

test("article detail page renders the cover image below the title", async ({
  authenticatedPage: page,
}) => {
  await page.setViewportSize({ width: 1440, height: 960 });

  // Author a fresh article with a cover image (slug uniqueness via timestamp)
  const slug = `detail-cover-${Date.now()}`;
  const title = `Detail cover ${Date.now()}`;
  await page.goto(`/@${username}/articles/new`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("article-title-input").fill(title);
  await page.getByTestId("article-slug-input").fill(slug);
  await page.getByTestId("article-category-input").fill("Process");

  const png = writeTempPng(`detail-cover-${Date.now()}.png`);
  await page
    .getByTestId("article-cover-image-picker")
    .locator('input[type="file"]')
    .setInputFiles(png);
  await expect(
    page.getByTestId("article-cover-image-picker").locator("img"),
  ).toHaveAttribute("src", /\.convex\.(cloud|site)\//, { timeout: 10_000 });

  await page.getByTestId("save-article-btn").click();
  await expect(page).toHaveURL(
    new RegExp(`/@${username}/articles/${slug}/edit$`),
    { timeout: 15_000 },
  );

  // Publish so the public detail route renders it
  await page.getByTestId("article-publish-toggle").click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: /^Publish$/ })
    .click();
  await expect(page.getByTestId("article-publish-toggle")).toHaveText(
    /^Unpublish$/,
    { timeout: 10_000 },
  );

  // Navigate to the public article detail route
  await page.goto(`/@${username}/articles/${slug}`, {
    waitUntil: "domcontentloaded",
  });

  // Title is present
  const heading = page.getByRole("heading", { level: 1, name: title });
  await expect(heading).toBeVisible({ timeout: 10_000 });

  // Cover image is present, points at Convex storage, and sits BELOW the title in DOM order
  const cover = page.getByTestId("article-detail-cover-image");
  await expect(cover).toBeVisible({ timeout: 10_000 });
  await expect(cover).toHaveAttribute("src", /\.convex\.(cloud|site)\//);

  // DOM ordering assertion: cover image follows the heading
  const orderingOk = await page.evaluate(() => {
    const h1 = document.querySelector("h1");
    const img = document.querySelector(
      '[data-testid="article-detail-cover-image"]',
    );
    if (!h1 || !img) return false;
    return Boolean(
      h1.compareDocumentPosition(img) & Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });
  expect(orderingOk).toBe(true);
});
```

**Run command:**
```bash
pnpm --filter=@feel-good/mirror exec playwright test e2e/article-detail-cover-image.authenticated.spec.ts
```

The test passes only if all four assertions hold:
1. The article-detail-cover-image testid is visible.
2. Its `src` is a Convex-storage URL (proves it's the persisted cover, not a placeholder).
3. The DOM order is `<h1>` → cover image (proves it sits **below** the title, the literal acceptance criterion).
4. The page also contains the title `<h1>` (sanity-check the route resolved).

## Constraints

- **Tier 3 verification minimum** (`.claude/rules/verification.md`): build + lint + screenshot. The Playwright spec adds Tier-5-grade coverage on top.
- **`next/image` is required** (not a bare `<img>`) — both the editor preview and `post-detail.tsx` use `next/image`, and the Convex hostnames are already whitelisted in `next.config.ts`. Using `<img>` would bypass the Next image optimizer and is inconsistent with the rest of the app.
- **No setTimeout for layout timing** (`.claude/rules/react-components.md`).
- **Component stays under 100 lines** (`.claude/rules/react-components.md`) — current file is 53 lines; the change adds ~12 lines, well within budget.
- **Worktree path discipline** (`.claude/rules/worktrees.md`) — Edit must use the worktree path `/Users/disquiet/Desktop/mirror/.worktrees/feature-article-cover-image/...`.

## Risks

- **CLS / hydration flash**: `next/image` with `fill` requires a sized parent. The wrapper uses `aspect-video w-full` so the slot is reserved before the image loads — same shape as post-detail, which is already in production.
- **`priority` is intentional** — the cover is above-the-fold on detail pages. Matches post-detail.
- **Visual regression on articles without a cover** is the most likely surprise. The conditional render guards it, but the title's `mb-*` adjustment changes spacing for the no-cover case too. Verify both states in screenshots before reporting done.

## Out-of-scope follow-ups (not in this PR)

- Showing covers in the article list cards.
- Open-Graph image meta tags using the cover URL.
- Lazy-loading + responsive `srcset` tuning beyond what `next/image` does by default.
