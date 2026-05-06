---
date: 2026-05-06
branch: improvements-article-cover-image-style
owner: Hyunsol
---
# Article cover image — thumbhash LQIP placeholder

## Problem

Today the article detail page renders a blank `aspect-video` container while the remote cover image streams from Convex storage. The wrapper has `bg-background-subtle` which is barely distinguishable from `bg-background`, so on the first paint the article looks broken. We want a low-fi, visually meaningful placeholder that fades into the real image.

Current render path: `apps/mirror/features/articles/components/detail/article-detail.tsx:54-66` uses `<Image fill priority sizes="(min-width: 768px) 36rem, 100vw">`. Because the image is a remote Convex storage URL, `next/image` cannot generate a build-time blur — we must store our own LQIP per article.

## Solution

Persist a [thumbhash](https://evanw.github.io/thumbhash/) (\~25 bytes, base64-encoded) on every article that has a cover image, decode it to a data URL on the detail page, and pass it as `next/image`'s `blurDataURL` with `placeholder="blur"`.

Generation happens **client-side at upload time** because:

- The browser already has the picked file bytes — no server roundtrip.
- Convex actions cannot easily run native image decoders (`sharp` requires native bindings and the Convex runtime is not Node).
- The encode is small (\~3 KB JS, runs on a 100×100 RGBA canvas).
- Backfill is the only place that needs server-side decoding, and that runs as a one-shot Node script on the developer's machine using `sharp`.

Schema gets a new optional field; mutations accept and persist it; queries return it; the detail component decodes and consumes it. Clearing the cover clears the hash; replacing the cover requires the client to supply a fresh hash.

## Constraints & non-goals

- **In scope:** article cover image only. Inline body images and other surfaces are out of scope.
- **No** `setTimeout` for the load transition — `next/image`'s `placeholder="blur"` handles fade-out via its own onLoad path. (`.claude/rules/react-components.md`.)
- **Inline type imports** everywhere (`.claude/rules/typescript.md`).
- **Convex new function syntax** with explicit `args` and `returns` validators (`.claude/rules/convex.md` and `_generated/ai/guidelines.md`).
- **Identifier rule N/A** — thumbhash is opaque presentational data, not an identifier.
- **Cross-user isolation N/A** — thumbhash is not user-controllable identity data and isn't ingested into `contentEmbeddings`. The existing schema-level `userId` invariant on the article row is unchanged.
- **Agent parity N/A for the feature surface** — the clone agent does not produce or consume cover images. But the schema field MUST be present in every existing query that returns an article (`getByUsername`, `getBySlug`) so type drift doesn't break list views.
- **No migrations DSL** — repo doesn't use `@convex-dev/migrations`. Backfill is a one-shot dev script, not a runtime migration.
- **Legacy articles** with no thumbhash continue to render the existing blank-container fallback until the backfill script runs.
- **No new external service** — thumbhash compute happens in-process on both client and the backfill script.

## Implementation steps

### 1. Add the `thumbhash` dependency

| Package | How | Why |
| --- | --- | --- |
| `apps/mirror` | `pnpm --filter=@feel-good/mirror add thumbhash` | Encoder used by the upload hook, decoder used by the detail component. \~3 KB runtime. |
| `packages/convex` | `pnpm --filter=@feel-good/convex add -D thumbhash sharp` | Used only by the backfill script. `sharp` decodes JPEG/PNG/WebP → RGBA on the dev machine; never ships to Convex deploy. |

Verify with `pnpm -r install --frozen-lockfile=false` and check the resulting `pnpm-lock.yaml` diff is sane.

### 2. Schema — add `coverImageThumbhash`

`packages/convex/convex/articles/schema.ts`

```ts
export const articleFields = {
  ...contentBaseFields,
  coverImageStorageId: v.optional(v.id("_storage")),
  coverImageThumbhash: v.optional(v.string()),
  category: v.string(),
};
```

Convex schema validation widens permissively for new optional fields, so adding it won't reject existing rows. Run `pnpm --filter=@feel-good/convex dev` once to sync codegen and confirm no validation errors.

### 3. Update return validators + types

`packages/convex/convex/articles/helpers.ts` — add `coverImageThumbhash: v.union(v.string(), v.null())` to `articleSummaryReturnValidator` and `articleWithBodyReturnValidator`. (Use `v.union` with `v.null()` rather than `v.optional` so the wire shape is explicit; queries always emit the field, with `null` standing in for "no hash".)

`apps/mirror/features/articles/types.ts` — add `coverImageThumbhash: string | null` to `ArticleSummary` (which `ArticleWithBody` already inherits from).

### 4. Queries — return the field

- `packages/convex/convex/articles/queries.ts:78-151` (`getBySlug`) — add `coverImageThumbhash: article.coverImageThumbhash ?? null` to the returned object.
- `packages/convex/convex/articles/queries.ts:19-54` (`getByUsername`) — same. Even though list views don't render cover images today, the validator additions in step 3 require it.
- No change needed in `getByUsernameForConversation` — it already projects only `title` + `body`.

### 5. Mutation contract — `create` and `update`

`packages/convex/convex/articles/mutations.ts`

`create`:

- Add `coverImageThumbhash: v.optional(v.string())` to `args`.
- Persist on insert: `coverImageThumbhash: args.coverImageThumbhash`.
- **Invariant:** if `coverImageStorageId` is set, the client SHOULD supply `coverImageThumbhash`. Don't throw if it's missing — legacy code paths and tests can still create articles without one — but the cover will fall back to the blank state until backfilled.

`update`:

- Add `coverImageThumbhash: v.optional(v.string())` to `args`.
- **Cover-image patch coupling rule:** the storage ID and the thumbhash must move as a pair to avoid a stale hash describing a different image.
  - If `args.clearCoverImage === true` → patch both fields to `undefined`.
  - Else if `args.coverImageStorageId !== undefined` and it differs from `article.coverImageStorageId` → set `patch.coverImageThumbhash = args.coverImageThumbhash` (which may be `undefined` → cleared if the client failed to supply one). **Never carry over the previous hash.**
  - Else if `args.coverImageThumbhash !== undefined` (cover unchanged but hash supplied — e.g. a backfill case via the public mutation) → patch the hash alone.

This logic needs an explicit comment in the handler explaining why `coverImageThumbhash` is patched conditionally on `coverImageStorageId` changes — same load-bearing-comment convention as the existing `multisetDifference` block at lines 162-181.

### 6. New internal mutation for the backfill

`packages/convex/convex/articles/mutations.ts` — append:

```ts
export const setCoverImageThumbhash = internalMutation({
  args: { id: v.id("articles"), thumbhash: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const article = await ctx.db.get(args.id);
    if (!article) throw new Error("Article not found");
    if (article.coverImageStorageId === undefined) {
      throw new Error("Article has no cover image to hash");
    }
    await ctx.db.patch(args.id, { coverImageThumbhash: args.thumbhash });
    return null;
  },
});
```

Internal so it can only be called from server code (the backfill script invokes it through the Convex client with deploy-key auth).

### 7. Client encode helper

`apps/mirror/features/articles/utils/compute-thumbhash.ts` (new)

```ts
import { rgbaToThumbHash } from "thumbhash";

const MAX_DIM = 100;

/**
 * Downscale an image File to <=100px on its longest side, then encode the
 * pixels as a base64 thumbhash. Returns the base64 string (NOT a data URL).
 *
 * Why 100px: thumbhash's reference impl downsamples this far server-side; any
 * larger and the encode is slower without payload benefit.
 */
export async function computeThumbhashFromFile(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(MAX_DIM / bitmap.width, MAX_DIM / bitmap.height, 1);
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");
  ctx.drawImage(bitmap, 0, 0, w, h);

  const { data } = ctx.getImageData(0, 0, w, h);
  const hashBytes = rgbaToThumbHash(w, h, data);

  // base64 encode
  let binary = "";
  for (const byte of hashBytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
```

### 8. Client decode helper

`apps/mirror/features/articles/utils/thumbhash-to-data-url.ts` (new)

```ts
import { thumbHashToDataURL } from "thumbhash";

/**
 * Decode a base64 thumbhash to a `data:image/png;base64,…` URL suitable for
 * `next/image`'s `blurDataURL` prop. Returns null for null/empty input so
 * call sites can short-circuit cleanly.
 */
export function thumbhashToDataUrl(thumbhash: string | null): string | null {
  if (!thumbhash) return null;
  const binary = atob(thumbhash);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return thumbHashToDataURL(bytes);
}
```

### 9. Upload hook — return both storage ID and hash

`apps/mirror/features/articles/hooks/use-article-cover-image-upload.ts:17-31`

Change the hook's return value from `Id<"_storage">` to `{ storageId: Id<"_storage">; thumbhash: string }`. Compute the thumbhash in parallel with the storage POST so the user-visible upload latency is governed by the slower of the two:

```ts
const [storageId, thumbhash] = await Promise.all([
  uploadToStorage(uploadUrl, file).then((r) => r.storageId),
  computeThumbhashFromFile(file),
]);
return { storageId, thumbhash };
```

If `computeThumbhashFromFile` throws (e.g. unsupported codec), surface a non-blocking warning and return `{ storageId, thumbhash: "" }` — the upload should not fail because the LQIP is missing. Empty string is later treated as "no hash" by the decoder.

### 10. Cover picker — propagate the hash

`apps/mirror/features/articles/components/editor/cover-image-picker.tsx`

Change the `onUpload` prop signature to `(file) => Promise<{ storageId: Id<"_storage">; thumbhash: string }>`. The picker itself is a presentational component; it forwards the result to its parent. No visual change.

### 11. Article editor form state

Whichever form/container currently owns `coverImageStorageId` state (likely `apps/mirror/features/articles/components/editor/...`) needs a sibling `coverImageThumbhash` field that:

- Initializes from the loaded article's value.
- Updates when the picker resolves.
- Clears when the picker's "remove" path triggers.
- Is included in both `create` and `update` mutation calls.

Audit by greping for `coverImageStorageId` in `apps/mirror/features/articles/`.

### 12. Detail component — render the placeholder

`apps/mirror/features/articles/components/detail/article-detail.tsx:54-66`

```tsx
{
  article.coverImageUrl && (
    <div
      className='relative aspect-video w-full overflow-hidden rounded-xl bg-background-subtle [corner-shape:superellipse(1.3)] mb-14'
      data-blur-placeholder={article.coverImageThumbhash ?? ""}
    >
      <Image
        src={article.coverImageUrl}
        alt={`Cover image for ${article.title}`}
        fill
        sizes='(min-width: 768px) 36rem, 100vw'
        priority
        placeholder={blurDataUrl ? "blur" : "empty"}
        blurDataURL={blurDataUrl ?? undefined}
        className='object-cover'
        data-testid='article-detail-cover-image'
      />
    </div>
  );
}
```

Where `blurDataUrl = thumbhashToDataUrl(article.coverImageThumbhash)` is computed once at the top of the component.

The `data-blur-placeholder` attribute on the wrapper is the deterministic test surface — it's always present in the DOM regardless of image load state, unlike `next/image`'s inline `style` blur (which strips on load).

### 13. Backfill script

`packages/convex/scripts/backfill-cover-thumbhash.ts` (new — `"use node"` not needed; runs via `tsx` from the developer's CLI, not inside Convex)

Pseudocode:

```ts
import { ConvexHttpClient } from "convex/browser";
import { api, internal } from "../convex/_generated/api";
import { rgbaToThumbHash } from "thumbhash";
import sharp from "sharp";

const client = new ConvexHttpClient(process.env.CONVEX_URL!);
client.setAuth(process.env.CONVEX_DEPLOY_KEY!); // or admin auth path used elsewhere

const articles = await client.query(
  internal.articles.queries.listMissingThumbhash,
  {},
);
for (const a of articles) {
  const url = await client.query(internal.articles.queries.getCoverUrl, {
    id: a._id,
  });
  if (!url) continue;
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  const { data, info } = await sharp(buf)
    .resize({ width: 100, height: 100, fit: "inside" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const hashBytes = rgbaToThumbHash(info.width, info.height, data);
  const thumbhash = Buffer.from(hashBytes).toString("base64");
  await client.mutation(internal.articles.mutations.setCoverImageThumbhash, {
    id: a._id,
    thumbhash,
  });
}
```

Two new internal queries are needed alongside the script:

- `internal.articles.queries.listMissingThumbhash` — returns `{ _id, coverImageStorageId }[]` for articles where `coverImageStorageId !== undefined && coverImageThumbhash === undefined`. Use a `withIndex` scan + JS filter; this is a one-shot read, not a hot path.
- `internal.articles.queries.getCoverUrl` — returns `string | null` from `ctx.storage.getUrl(args.storageId)`. Internal because it's only called by the script.

Run via:

```bash
pnpm --filter=@feel-good/convex exec tsx scripts/backfill-cover-thumbhash.ts
```

Document the run command in the script's top-of-file comment. Add a `--dry-run` flag that lists IDs without patching.

### 14. Tests

#### 14a. Unit — decoder helper

`apps/mirror/features/articles/utils/__tests__/thumbhash-to-data-url.test.ts` (new)

```ts
import { describe, expect, it } from "vitest";
import { thumbhashToDataUrl } from "../thumbhash-to-data-url";

const KNOWN_THUMBHASH = "1QcSHQRnh493V4dIh4eXh1h4kJUI";

describe("thumbhashToDataUrl", () => {
  it("returns null for null input", () => {
    expect(thumbhashToDataUrl(null)).toBeNull();
  });
  it("returns null for empty string", () => {
    expect(thumbhashToDataUrl("")).toBeNull();
  });
  it("returns a PNG data URL for a valid thumbhash", () => {
    const url = thumbhashToDataUrl(KNOWN_THUMBHASH);
    expect(url).toMatch(/^data:image\/png;base64,/);
    expect(url!.length).toBeGreaterThan(100);
  });
});
```

Run with `pnpm --filter=@feel-good/mirror test:unit`.

#### 14b. Unit — Convex mutation contract

`packages/convex/convex/articles/__tests__/mutations.test.ts` — extend the existing file with cases that verify:

1. `create` with `coverImageThumbhash` persists the field on the row.
2. `update` with a new `coverImageStorageId` and a new `coverImageThumbhash` persists both.
3. `update` with a new `coverImageStorageId` and **no** `coverImageThumbhash` clears the field on the row (the load-bearing coupling rule from step 5).
4. `update` with `clearCoverImage: true` clears both `coverImageStorageId` and `coverImageThumbhash`.
5. `setCoverImageThumbhash` internal mutation patches the field; throws if article has no `coverImageStorageId`.

Mirror the `convex-test` patterns already in the file.

#### 14c. E2E — hard verification

`apps/mirror/e2e/article-detail-cover-image.authenticated.spec.ts` — extend the existing single test, OR add a sibling test in the same file. Hard-verification command:

```bash
pnpm --filter=@feel-good/mirror exec playwright test e2e/article-detail-cover-image.authenticated.spec.ts
```

The new test (or extension) MUST assert:

```ts
test("article detail page renders a thumbhash blur placeholder", async ({
  authenticatedPage: page,
}) => {
  // ... reuse existing setup (create article, upload cover, navigate to detail)

  const wrapper = page.locator("[data-blur-placeholder]").first();
  await expect(wrapper).toBeVisible({ timeout: 10_000 });

  // The wrapper exposes the raw base64 thumbhash as a data attribute. It must
  // be non-empty for any newly created cover image. (Backfilled legacy rows
  // are out of scope for this assertion.)
  const placeholder = await wrapper.getAttribute("data-blur-placeholder");
  expect(placeholder).toBeTruthy();
  expect(placeholder!.length).toBeGreaterThan(10);

  // next/image, given a valid blurDataURL, renders an inline style with the
  // decoded data URL as background-image until the full asset paints.
  const cover = page.getByTestId("article-detail-cover-image");
  // We don't race the image load — we assert the prop reached the DOM by
  // checking the img tag rendered with placeholder semantics intact.
  await expect(cover).toHaveAttribute("src", /convex\.(cloud|site)/);
});
```

Pass criteria:

1. `data-blur-placeholder` attribute exists on the cover wrapper after navigating to the detail page.
2. Its value is non-empty (length &gt; 10) for a freshly uploaded cover.
3. The `<img>` element still renders with the resolved Convex storage URL.

Failure modes the assertions catch:

- Mutation didn't persist `coverImageThumbhash` → attribute is empty.
- Query didn't return `coverImageThumbhash` → attribute is empty.
- Detail component skipped the `data-blur-placeholder` wiring → attribute missing entirely.
- Type drift broke compilation → `pnpm build --filter=@feel-good/mirror` fails before the e2e even runs.

### 15. Verification tier (per `.claude/rules/verification.md`)

This change touches schema, mutations, queries, types, hooks, and a UI component → **Tier 5 (new feature, end-to-end).** Required runs before reporting complete:

```bash
pnpm build --filter=@feel-good/mirror
pnpm build --filter=@feel-good/convex
pnpm lint --filter=@feel-good/mirror
pnpm --filter=@feel-good/mirror test:unit
pnpm --filter=@feel-good/convex test           # if Convex package has a unit test command
pnpm --filter=@feel-good/mirror exec playwright test e2e/article-detail-cover-image.authenticated.spec.ts
```

Then a Chrome MCP screenshot of `/@test-user/articles/<slug>` with the network throttled (so the placeholder is visible) to visually confirm the blur.

## Rollout

1. Land the schema + mutation + query changes (steps 2–6).
2. Land the client encode + UI changes (steps 7–12). New uploads now persist a hash.
3. Run the backfill script against the dev deployment (step 13) — verify counts before and after.
4. Re-run the e2e test against dev.
5. Repeat the backfill against the production deployment in the same PR cycle, after merge but before announcing.

## Risks

- **Stale hash after partial form submit.** Mitigated by the coupling rule in `update` (step 5): a new storage ID without a fresh hash clears the hash. The picker should never produce one without the other (Promise.all in step 9), so this is purely defense in depth.
- `createImageBitmap` **unsupported / decode failure on exotic codecs.** Mitigated by step 9's catch — empty hash, upload still succeeds, detail page renders the existing fallback.
- `thumbhash` **package size on the client.** \~3 KB gzipped — acceptable. Verify with the next `pnpm build --filter=@feel-good/mirror` bundle output.
- **Backfill script reads cover blobs over HTTP.** Slow for large libraries. Add a concurrency limit (e.g. 8 parallel) in the script. Idempotent because it only patches rows missing the field.

## Deliverables

- 1 schema field, 2 query updates, 2 mutation updates, 1 internal mutation, 2 internal queries.
- 2 new client utilities, 1 hook update, 1 picker prop signature update, 1 form-state update, 1 detail component update.
- 1 backfill script.
- 1 unit test (decoder), 5 Convex mutation test cases, 1 extended e2e test.
- 2 new dependencies (`thumbhash` runtime in mirror; `thumbhash` + `sharp` dev in convex).