# Tiptap Inline Image Lifecycle — Spec

**Created:** 2026-04-30

**Source research:** [`workspace/research/tiptap-inline-image-lifecycle.md`](../research/tiptap-inline-image-lifecycle.md)

## What the user gets

- I can paste or drop an image into an article (or post) body and it appears inline immediately, with a brief upload spinner that resolves to the final image.
- When I import a markdown file that has `![]()` images linking to external URLs, those images come along — they show up in the imported body without me doing anything extra, and they keep working long after the original URL might break.
- When I edit an article and remove an image I uploaded earlier, the blob storage stops paying for it: it's cleaned up the moment I save.
- When I delete an article or post, every image that lived in that body is cleaned up too. Nothing leaks.
- I never see a broken image on an old article because of an expired URL — images that I uploaded keep rendering forever.

## Non-goals

- **No collaborative real-time editing.** Mirror has a single author per article today; concurrent-edit conflict handling for inline images is out of scope. (Sources: research report §"Out of scope but interesting", `apps/mirror/AGENTS.md` makes no mention of collab editing.)
- **No image transformations or responsive variants.** No resizing, format conversion, or `srcset` generation. The blob is stored as uploaded. Adding a CDN/transform pipeline later does not invalidate any choice in this spec.
- **No video, audio, or generic file attachments.** Only static images (PNG / JPEG / WEBP). The architecture would extend cleanly but the lifecycle policy and SSRF/MIME guards are scoped to images.
- **No body validator tightening.** `body: v.any()` (`packages/convex/convex/content/schema.ts:12`) stays as-is. Switching to a recursive `JSONContent` validator is a separate refactor that touches all existing seeded content.
- **No retroactive backfill.** Existing articles whose bodies contain external-URL images written before this feature shipped are not migrated — they continue to render as raw external URLs and are not lifecycle-tracked. Future content goes through the new pipeline.
- **No image deletion via undo.** If a user removes an image then undoes the removal, the blob may have already been deleted by the next save. We accept this trade-off (matches Plane's known design choice for non-collaborative single-user editing).

## How we'll know it works

Each row is the source of truth for one Playwright E2E scenario. Authentication uses the existing `e2e/fixtures/auth.ts` pattern from `apps/mirror/e2e/post-cover-image.authenticated.spec.ts`.

| Scenario (user-flow language) | Expected outcome | Test file | Verifies |
| ----------------------------- | ---------------- | --------- | -------- |
| Author opens an article in edit mode and pastes a PNG from clipboard | Image appears inline within the editor; saving the article persists a body that contains a Convex-served URL for that image | `apps/mirror/e2e/article-inline-image-paste.authenticated.spec.ts` | FR-01, FR-02, FR-03 |
| Author opens an article in edit mode, drops a WEBP file onto the editor | Image appears inline; Convex storage receives the blob and the saved body references it by `storageId` | `apps/mirror/e2e/article-inline-image-drop.authenticated.spec.ts` | FR-01, FR-02, FR-03 |
| Author edits an article that has two inline images, deletes one image, and saves | The deleted image's blob is removed from Convex storage; the remaining image still renders on reload | `apps/mirror/e2e/article-inline-image-replace.authenticated.spec.ts` | FR-06 |
| Author deletes an article that has three inline images plus a cover image | All four blobs are removed from Convex storage | `apps/mirror/e2e/article-inline-image-cascade-delete.authenticated.spec.ts` | FR-07 |
| Author imports a markdown file containing `![](https://example.com/image.png)` | The post is created with the image rendering inline, served from Convex storage (not the original URL) | `apps/mirror/e2e/post-markdown-image-import.authenticated.spec.ts` | FR-08, FR-09 |
| Author tries to upload a 10 MB JPEG inline | The editor surfaces a clear error; no blob is written to storage | `apps/mirror/e2e/article-inline-image-size-limit.authenticated.spec.ts` | FR-11 |
| Author tries to paste a GIF | The editor surfaces a clear error message about supported formats; no blob is written | `apps/mirror/e2e/article-inline-image-mime-limit.authenticated.spec.ts` | FR-11 |
| Same paste-and-save flow as the first scenario, exercised on a post | Same outcomes — articles and posts behave identically | `apps/mirror/e2e/post-inline-image-paste.authenticated.spec.ts` | FR-01, FR-02, FR-03 |

## Requirements

### Functional Requirements

| ID | Requirement | Priority | Verification |
| --- | --- | --- | --- |
| FR-01 | The article and post Tiptap editors expose a custom Image extension whose schema includes a `storageId: v.id("_storage")` attribute alongside the stock `src`, `alt`, `title`, `width`, `height` attributes. The attribute round-trips through `parseHTML`/`renderHTML` as `data-storage-id`. | P0 | Vitest: assert `extensions.find(e => e.name === "image").config.addAttributes()` includes `storageId` with `parseHTML` and `renderHTML`. Playwright: paste flow produces a node containing `storageId` in saved body. |
| FR-02 | New public Convex mutations `generateArticleInlineImageUploadUrl` and `generatePostInlineImageUploadUrl` — both wrapped in `authMutation`, taking no args, returning `v.string()`, calling `ctx.storage.generateUploadUrl()`. Companion public queries `getArticleInlineImageUrl({ storageId })` and `getPostInlineImageUrl({ storageId })` — both wrapped in `authQuery`, returning `v.union(v.string(), v.null())`, calling `ctx.storage.getUrl(storageId)`. Files: `packages/convex/convex/{articles,posts}/inlineImages.ts`. | P0 | Vitest: call mutation as authed user → URL string; call without auth → throws. Vitest: query returns URL for valid storageId, `null` for missing. |
| FR-03 | A ProseMirror upload plugin (`packages/features/editor/lib/inline-image-upload-plugin.ts`) inserts a `Decoration.widget` placeholder at the paste/drop position keyed by a unique JS object identity, calls a passed-in `onUpload(file: File) => Promise<{ storageId: Id<"_storage">; url: string }>`, then on resolution replaces the placeholder with an `image` node whose `src` and `storageId` come from the upload result. On upload error or if the placeholder region was deleted by the user mid-upload, the placeholder is silently removed. | P0 | Vitest with happy-dom: simulate paste event → assert decoration set has 1 widget; resolve mocked upload → assert image node inserted at correct mapped position. |
| FR-04 | The shared HTML sanitizer (`packages/features/editor/lib/sanitize-content.ts`) preserves the `storageId` attribute on `image` nodes. The attribute value must match `/^[a-zA-Z0-9_-]+$/` (XSS-prevention shape, not exact Convex ID format — Convex's `_storage` ID character set is not contractually documented and may change); non-matching values are stripped. | P0 | Vitest: feed sanitizer an image node with valid `storageId` → preserved; with `<script>` payload → stripped; with hyphen/underscore → preserved. |
| FR-05 | The article and post **detail** queries (`getBySlug` for both surfaces) walk the body before returning it and rewrite each image node's `src` to a freshly resolved `ctx.storage.getUrl(storageId)`. If `storageId` is absent (legacy external URLs) the existing `src` is left untouched. **Exemption (articles only):** `getByUsernameForConversation` (which exists only on the articles surface — posts have no equivalent) returns body verbatim; image nodes are not visited by the text extractor (`embeddings/textExtractor.ts:24-33` excludes `"image"` from `blockTypes`), so URL resolution is not needed for AI-clone consumption. Posts have no conversation query and so no posts-side exemption applies. | P0 | Vitest (articles): detail query with `{ image: { storageId: <id> }}` → response `src` equals `await ctx.storage.getUrl(id)`. Vitest (articles): `getByUsernameForConversation` returns body unchanged. Vitest (posts): detail query rewrite verified; no conversation-query test. |
| FR-06 | The `update` mutations for articles and posts walk the existing stored body and the incoming body via `extractInlineImageStorageIds` (new: `packages/convex/convex/content/body-walk.ts`), compute the multiset difference (old − new), and call `ctx.storage.delete()` on each removed `storageId` AFTER the `ctx.db.patch` succeeds. The diff is a counting multiset, not a `Set`, so duplicates are handled correctly. **Capped at 50 inline storage deletes per invocation** (NFR-06); any excess is left for the cron sweep. **Cover-image ordering carve-out closed:** the original spec deferred article cover-image ordering changes to avoid test churn, but follow-up tickets FG_097 (`articles.update`) and FG_098 (`articles.remove`) closed that carve-out. Both surfaces now delete the previous cover blob AFTER the corresponding `ctx.db.patch` / `ctx.db.delete` succeeds, matching `posts.{update,remove}` and the inline-image cascade. The "live row points at a missing asset" failure mode is no longer possible; the cron sweep handles a failed cover delete. | P0 | Vitest: update article removing one of two duplicate inline images → 0 deletes; remove the only copy → 1 delete; remove one of two distinct → 1 delete; remove 60 → 50 deleted, 10 left for cron. |
| FR-07 | The `remove` mutations for articles and posts walk the body via `extractInlineImageStorageIds`, then delete every inline `storageId` (in addition to the existing `coverImageStorageId` cascade), AFTER `ctx.db.delete` succeeds. | P0 | Vitest: insert article with 3 inline images + 1 cover → delete article → all 4 storage IDs deleted. |
| FR-08 | A new internal action `importMarkdownInlineImages` (in `packages/convex/convex/{articles,posts}/actions.ts`, both with `"use node"`) walks a body for image nodes whose `src` is an absolute external URL with no `storageId`, fetches each via `safeFetchImage` (new helper in `packages/convex/convex/content/safe-fetch.ts`), stores the bytes via `ctx.storage.store(blob)`, then calls a sibling internal mutation `_patchInlineImageBody` that replaces the `src` with a Convex-served URL and sets `storageId`. **Markdown-imported posts/articles are forced to `status: "draft"` until the action completes** — only after image processing completes can the user manually publish. Embedding regeneration is intentionally NOT triggered by the body patch (text extractor skips image nodes; image rewrites do not affect extracted text). The action's failures (network, content-type, size, SSRF reject) leave the original `src` intact and continue with the next image; the post stays in draft state if any inline import failed and the user is shown which images failed. | P0 | Vitest with mocked `safeFetchImage`: returns a PNG blob → action stores it and patches body. Returns null (failure) → original src preserved, status stays draft. |
| FR-09 | The shared `createMarkdownExtensions()` factory (`packages/features/editor/lib/extensions.ts`) registers `Image` so `![](url)` markdown produces image nodes (currently they are silently dropped). | P0 | Vitest: feed `markdownToJsonContent("![alt](https://x/y.png)")` → returns body with image node carrying that src. |
| FR-10 | A new daily cron job `sweepOrphanedStorage` (registered in `packages/convex/convex/crons.ts`) runs an `internalMutation` that paginates through `_storage` system table entries older than 24 hours via `ctx.db.system.query("_storage").withIndex("by_creation_time", q => q.lt("_creationTime", now - ORPHAN_GRACE_MS))` (no `.filter()` per `.claude/rules/convex.md`); for each candidate, checks against the union of (a) every `v.id("_storage")` field referenced by **any** schema table — verified at spec-implementation time via `grep -r 'v.id("_storage")' packages/convex/convex/` to ensure exhaustive coverage — and (b) every inline `storageId` extracted by walking every article + post body; deletes any candidate not in the referenced set. | P0 | Vitest: seed 10 storage blobs, 7 referenced (cover + inline + avatar), 2 orphaned older than 24h, 1 orphan younger than 24h → sweep deletes exactly 2. |
| FR-11 | Inline image uploads (paste, drop, file picker) and markdown imports enforce: content-type ∈ `{image/png, image/jpeg, image/webp}`, size ≤ 5 MiB. Constants are defined once in a new `apps/mirror/lib/media-policy.ts` and imported by all upload sites (cover image, inline image, markdown action). | P0 | Vitest: helper rejects gif and 6 MB PNG; accepts 4 MB WEBP. Playwright: see scenarios `article-inline-image-size-limit` and `article-inline-image-mime-limit`. |
| FR-12 | Inline image upload URL mutations require an authenticated session (delegate to `authMutation`); unauthenticated calls throw `ConvexError`. The cron sweep runs as `internalMutation` and is not exposed to the public API. The markdown-import action (`internal.{articles,posts}.actions.importMarkdownInlineImages`) is registered as an `internalAction` and is wrapped by a public action `import{Article,Post}MarkdownInlineImages` in `inlineImages.ts` that performs explicit auth + ownership checks (via `authComponent.getAuthUser` + `_get{Article,Post}Ownership` internal query) before delegating. The internal action additionally takes an `ownerId: v.id("users")` arg and re-verifies that the entity row's `userId` matches before proceeding (defense in depth — closes the gap structurally if a future caller bypasses the public wrapper). The internal action is only safe to call from this wrapper; direct callers must verify ownership themselves. | P0 | Vitest: call `generateArticleInlineImageUploadUrl` without auth → throws. Vitest: call `internal.articles.actions.importMarkdownInlineImages` with a mismatched `ownerId` → throws. |

### Non-functional Requirements

| ID | Requirement | Priority | Verification |
| --- | --- | --- | --- |
| NFR-01 | `safeFetchImage` (`packages/convex/convex/content/safe-fetch.ts`) provides **best-effort IP-blocklist SSRF protection** — explicitly NOT resistant to DNS rebinding (resolve-then-bind-IP would be required and is out of scope). Rejects: non-`https` scheme; hostnames resolving via `node:dns/promises` to RFC1918 / loopback / link-local / IPv6-ULA addresses. **Each redirect hop's target hostname is re-resolved via `node:dns/promises` and the resolved IP re-checked against the same blocklist before initiating the next request** (NOT a string-pattern check on the URL). Manual redirect handling, max depth = `MAX_FETCH_REDIRECTS = 3` (constant in `storage-policy.ts`). Uses 10-second total timeout. Aborts and rejects responses where `Content-Length` or streamed bytes exceed 5 MiB. | P0 | Vitest with mocked `dns.lookup` and `fetch`: rejects `http://`; rejects `https://attacker.com` where `attacker.com` resolves to `127.0.0.1` (DNS-level rejection, not URL-string-level); rejects redirect chain to a hostname that resolves to a private IP; rejects redirect depth > 3. Accepts `https://example.com/image.png` returning small PNG. |
| NFR-02 | Cron sweep is paginated on the `_storage` system table to keep each invocation under Convex's mutation execution budget. Processes at most 200 storage entries per page; self-schedules next page via `ctx.scheduler.runAfter(0, ...)`. **Article/post full-table walk is NOT paginated** — accepted for the stated personal-blogging scope (assumed ceiling: <1000 articles + posts total). If this scope changes, sweep must be re-architected. | P1 | Vitest: seed 500 candidate orphans → multi-page run, all deleted. Document this scope assumption in cron file header comment. |
| NFR-03 | Body walking is O(n) in node count via a single recursive descent — no JSON serialize/deserialize round-trip per call. The walker is a pure function in `packages/convex/convex/content/body-walk.ts` (no Convex runtime imports), exported via `package.json` `exports` and `typesVersions` for cross-package use. | P1 | Vitest: 500-node body completes <50ms (loose budget — guards against quadratic regressions). |
| NFR-04 | The 24-hour orphan grace period (constant `ORPHAN_GRACE_MS` in `packages/convex/convex/content/storage-policy.ts`) exceeds Convex's 1-hour upload URL expiry plus any reasonable client retry window. No magic-number duplicates anywhere. | P1 | Vitest imports the constant; cron uses it; grep for `24 * 60 * 60 * 1000` returns only the definition. |
| NFR-05 | The decoration-placeholder upload plugin tolerates concurrent uploads. Two paste events fired ~200ms apart produce two placeholders keyed by distinct object identities; either upload resolving in any order replaces only its own placeholder. The plugin guards `view.dispatch(...)` calls with `view.dom.isConnected` to no-op safely if the editor unmounts mid-upload. | P1 | Vitest: simulate two concurrent uploads; each replaces its own placeholder. Vitest: simulate editor unmount during upload — no throw, no crash. |
| NFR-06 | Per-mutation cap on inline storage deletes: at most 50 `ctx.storage.delete()` calls in any single `update` or `remove` invocation. Excess removed-set entries are left in `_storage` and collected by the next cron sweep. Prevents a malicious or accidental large-body mutation from exhausting the mutation execution budget. | P1 | Vitest: update mutation diff returns 60 removed IDs → exactly 50 are deleted in-mutation, remaining 10 verified deleted on next cron run. |

## Architecture

### 1. Components and structure

**Files to create:**

| File | Purpose |
| --- | --- |
| `packages/features/editor/lib/inline-image-extension.ts` | Tiptap custom Image extension extending `@tiptap/extension-image` with `storageId` attribute via `addAttributes()`. |
| `packages/features/editor/lib/inline-image-upload-plugin.ts` | ProseMirror plugin: `Plugin`/`PluginKey` from `@tiptap/pm/state`, `Decoration`/`DecorationSet` from `@tiptap/pm/view`. Exports `createInlineImageUploadPlugin({ onUpload })`. |
| `packages/features/editor/components/rich-text-editor.tsx` | New write-mode editor (`editable: true`); accepts `content`, `onChange`, `onImageUpload` props. |
| `packages/features/editor/__tests__/inline-image-extension.test.ts` | Vitest unit tests for the extension's attribute schema. |
| `packages/features/editor/__tests__/inline-image-upload-plugin.test.ts` | Vitest unit tests for placeholder lifecycle (insert / map / replace / drop). |
| `packages/features/editor/__tests__/sanitize-storage-id.test.ts` | Vitest tests for `storageId` attribute sanitization. |
| `packages/convex/convex/content/body-walk.ts` | Pure utility: `extractInlineImageStorageIds(body: JSONContent): Id<"_storage">[]`, `mapInlineImages(body, mapFn)` for in-place rewrites. No Convex runtime imports. |
| `packages/convex/convex/content/safe-fetch.ts` | `safeFetchImage(url, { maxBytes, timeoutMs })`: SSRF-safe fetch returning `Blob`. Uses `node:dns/promises` to resolve and reject non-public IPs before initiating the request, plus a `redirect: "manual"` policy to re-validate every hop. |
| `packages/convex/convex/content/storage-policy.ts` | Shared constants: `ORPHAN_GRACE_MS`, `MAX_INLINE_IMAGE_BYTES`, `ALLOWED_INLINE_IMAGE_TYPES`. |
| `packages/convex/convex/content/__tests__/body-walk.test.ts` | Vitest. |
| `packages/convex/convex/content/__tests__/safe-fetch.test.ts` | Vitest with mocked DNS + fetch. |
| `packages/convex/convex/articles/inlineImages.ts` | Public mutation `generateArticleInlineImageUploadUrl` and public query `getArticleInlineImageUrl`. |
| `packages/convex/convex/articles/actions.ts` | `"use node"`. Internal action `importMarkdownInlineImages` (called from `use-create-post-from-file.ts`-equivalent for articles, when added). Internal mutation `_patchInlineImageBody` (called by the action). |
| `packages/convex/convex/articles/__tests__/inline-images.test.ts` | Vitest covering FR-02, FR-06, FR-07, FR-08, FR-12. |
| `packages/convex/convex/posts/inlineImages.ts` | Public mutation `generatePostInlineImageUploadUrl` and public query `getPostInlineImageUrl`. |
| `packages/convex/convex/posts/actions.ts` | `"use node"`. Mirrors articles `actions.ts`. |
| `packages/convex/convex/posts/__tests__/inline-images.test.ts` | Vitest mirror of articles test file. |
| `packages/convex/convex/content/__tests__/orphan-sweep.test.ts` | Vitest covering FR-10 and NFR-02. (Placed under `content/` because `packages/convex/vitest.config.ts:15-21` includes only specific subdirectory globs; `convex/content/**/*.test.ts` is on that list, while a top-level `convex/__tests__/` is not.) |
| `apps/mirror/lib/media-policy.ts` | Re-exports `ALLOWED_INLINE_IMAGE_TYPES` (as `Set` and as joined `"image/png,image/jpeg,image/webp"` string for `<input accept>`) and `MAX_INLINE_IMAGE_BYTES` from `@feel-good/convex/convex/content/storage-policy`. Single source of truth for client-side validation. |
| `apps/mirror/features/articles/hooks/use-article-inline-image-upload.ts` | Wraps `generateArticleInlineImageUploadUrl` + `uploadToStorage` + `getArticleInlineImageUrl` query (called imperatively via `convexClient.query` after upload). Returns `{ upload(file) → { storageId, url } }` to the plugin in a single call. |
| `apps/mirror/features/posts/hooks/use-post-inline-image-upload.ts` | Mirror for posts. |
| `apps/mirror/app/[username]/articles/[slug]/edit/page.tsx` | Article edit page. **Server component** performs the ownership/auth check: reads the session via `auth.api.getSession` (or the existing app-level session helper), loads the article, and `redirect("/sign-in")` if unauthenticated OR the session user is not the article owner. On pass-through, renders the client component. Required for E2E tests to have a UI surface; thin route. |
| `apps/mirror/app/[username]/articles/[slug]/edit/_components/article-editor-page.tsx` | Client component for the article edit page (form state, mounts `RichTextEditor`, Save button calls `api.articles.mutations.update`, basic error toast on save failure; cancel returns to detail page; unsaved-changes warnings, draft autosave, and same-page cover-image editing are explicitly out of scope for this spec). |
| `apps/mirror/app/[username]/posts/[slug]/edit/page.tsx` | Post edit page. Same server-component auth pattern as articles. |
| `apps/mirror/app/[username]/posts/[slug]/edit/_components/post-editor-page.tsx` | Client component for the post edit page; same scope notes. |
| `apps/mirror/e2e/article-inline-image-paste.authenticated.spec.ts` | Playwright. |
| `apps/mirror/e2e/article-inline-image-drop.authenticated.spec.ts` | Playwright. |
| `apps/mirror/e2e/article-inline-image-replace.authenticated.spec.ts` | Playwright. |
| `apps/mirror/e2e/article-inline-image-cascade-delete.authenticated.spec.ts` | Playwright. |
| `apps/mirror/e2e/article-inline-image-size-limit.authenticated.spec.ts` | Playwright. |
| `apps/mirror/e2e/article-inline-image-mime-limit.authenticated.spec.ts` | Playwright. |
| `apps/mirror/e2e/post-inline-image-paste.authenticated.spec.ts` | Playwright. |
| `apps/mirror/e2e/post-markdown-image-import.authenticated.spec.ts` | Playwright. |

**Files to modify:**

| File | Change |
| --- | --- |
| `packages/features/editor/lib/extensions.ts` | `createArticleExtensions()` swaps stock `Image` for the new custom extension; `createMarkdownExtensions()` adds it too (FR-09). |
| `packages/features/editor/lib/sanitize-content.ts` | Add `"storageId"` to `ALLOWED_ATTRS["image"]` (currently line 31); add a per-attribute validator that requires `/^[a-zA-Z0-9_-]+$/` for `storageId` (XSS-prevention shape, not exact Convex ID format) and strips it otherwise (FR-04). |
| `packages/features/editor/components/rich-text-viewer.tsx` | No behavior change; ensure new attribute round-trips through render. |
| `packages/features/editor/lib/index.ts` | Export `createInlineImageUploadPlugin`, `createInlineImageExtension`. |
| `packages/features/editor/index.ts` | Export `RichTextEditor`. |
| `packages/convex/convex/articles/mutations.ts` | (a) `update`: walk old body via `extractInlineImageStorageIds`, walk incoming body, multiset-diff, delete removed inline IDs AFTER successful patch, capped at 50 per invocation (FR-06, NFR-06). Previous cover blob is also deleted AFTER `ctx.db.patch` (FG_097 closed the original carve-out so cover ordering matches posts.update and the inline-image cascade). (b) `remove`: walk body, delete inline IDs (capped at 50) after `ctx.db.delete` (FR-07); cover blob is also deleted AFTER `ctx.db.delete` (FG_098 closed the carve-out for the remove path, matching posts.remove). |
| `packages/convex/convex/posts/mutations.ts` | Same diffing + cascade additions; ordering already correct. |
| `packages/convex/convex/articles/queries.ts` | `getBySlug` rewrites image node `src` from `storageId` (FR-05). |
| `packages/convex/convex/posts/queries.ts` | Same. |
| `packages/convex/convex/crons.ts` | Register `sweepOrphanedStorage` cron at 24-hour interval; define the `internalMutation` here following the `clearStaleStreamingLocks` pattern. |
| `packages/convex/package.json` | Add `exports` and `typesVersions` entries for `convex/content/body-walk`, `convex/content/safe-fetch`, `convex/content/storage-policy`. |
| `apps/mirror/features/posts/lib/parsers/markdown-to-json-content.ts` | Use `createMarkdownExtensions()` which now includes Image. |
| `apps/mirror/features/posts/hooks/use-create-post-from-file.ts` | Force `status: "draft"` on `create` regardless of source markdown front-matter; after `create` returns, fire `internal.posts.actions.importMarkdownInlineImages` (via `useAction`); surface progress + per-image failure list to the upload dialog. The user manually publishes after import completes. |
| `apps/mirror/features/posts/components/markdown-upload-dialog-connector.tsx` | Replace inline `MAX_COVER_IMAGE_BYTES` and `ALLOWED_COVER_IMAGE_TYPES` with imports from `apps/mirror/lib/media-policy.ts`. |
| `apps/mirror/features/posts/components/cover-image-picker.tsx` | Same: replace inline `ACCEPTED_COVER_IMAGE_TYPES` with import from `apps/mirror/lib/media-policy.ts`. |

**Dependencies to add:**

- None. `@tiptap/extension-image`, `@tiptap/pm`, `tiptap-markdown` are all installed at compatible versions (`packages/features/package.json` lines 47–54). Node's built-in `node:dns/promises` is used for SSRF guards in the `"use node"` action.

### 2. How data flows

**Paste/drop upload (interactive):**

1. User pastes image into editor (or drops a file).
2. `inline-image-upload-plugin` intercepts the `paste` / `drop` ProseMirror event and extracts the `File`.
3. Plugin generates a fresh `id = {}` (object identity), inserts a `Decoration.widget` at `pos = state.selection.from`, dispatches a transaction with `setMeta(pluginKey, { add: { id, pos } })`.
4. Plugin invokes `onUpload(file)` (passed in by `RichTextEditor`'s consumer, e.g., the article edit page).
5. `useArticleInlineImageUpload` hook validates content-type and size against `media-policy` (rejects → throws → plugin removes placeholder, surfaces error toast).
6. Hook calls `useMutation(api.articles.inlineImages.generateArticleInlineImageUploadUrl)` → receives upload URL.
7. Hook POSTs file via `uploadToStorage(file, url)` → receives `{ storageId }`.
8. **Hook calls `convexClient.query(api.articles.inlineImages.getArticleInlineImageUrl, { storageId })` imperatively** (NOT `useQuery` — wrong semantics for one-shot in async callback) → receives signed `url`. This is the canonical path; the second round-trip is accepted as the cost of the `storageId`-in-node design.
9. Hook returns `{ storageId, url }` to plugin.
10. Plugin captures `view` in the original event-handler closure (so it survives the async gap). On resolution, runs `findPlaceholder(view.state, id)` to remap position (drift-safe); if `null`, the user deleted that region — plugin silently discards and removes the decoration.
11. **Plugin guards with `if (!view.dom.isConnected) { remove decoration only; do not dispatch }`** — handles editor-unmount-during-upload safely (NFR-05). Otherwise dispatches `tr.replaceWith(pos, pos, schema.nodes.image.create({ src: url, storageId }))` and `setMeta(pluginKey, { remove: { id } })`.
12. The editor's `onChange` fires; consumer accumulates updates and calls `api.articles.mutations.update` with the new body when the user clicks Save.

**Save (`update` mutation):**

1. Mutation handler reads the existing `article` doc.
2. Calls `extractInlineImageStorageIds(article.body)` → `oldIds: Id<"_storage">[]`.
3. Calls `extractInlineImageStorageIds(args.body)` → `newIds`.
4. Computes `removed = multisetDifference(oldIds, newIds)` (counts occurrences).
5. Calls `ctx.db.patch(article._id, { body: args.body, ... })`.
6. After patch succeeds, iterates `removed` and calls `ctx.storage.delete(id)` for each.
7. Cover image cleanup follows the same after-patch ordering.

**Delete (`remove` mutation):**

1. For each owned article in the iteration:
   1. `inlineIds = extractInlineImageStorageIds(article.body)`.
   2. `ctx.db.delete(article._id)`.
   3. For each id in `inlineIds`, `ctx.storage.delete(id)`.
   4. If `coverImageStorageId`, delete it.
   5. Schedule embedding deletion (existing flow).

**Markdown import:**

1. User uploads markdown file via `markdown-upload-dialog`.
2. `markdownToJsonContent(markdown)` (now Image-aware) returns body with `image` nodes carrying external `src` and no `storageId`.
3. `use-create-post-from-file` calls `api.posts.mutations.create({ body, coverImageStorageId?, status: "draft" })` — **status forced to draft regardless of any front-matter directive**, closing the published-with-external-URLs window.
4. After `create` returns `postId`, hook calls `useAction(api.posts.actions.importMarkdownInlineImages, { postId })`.
5. Action (Node runtime) reads the post, walks body for image nodes lacking `storageId`.
6. For each external URL:
   1. `safeFetchImage(url)` resolves DNS → checks not private/loopback/link-local → fetches with 10s timeout, max 5 MiB, manual redirect handling (max depth `MAX_FETCH_REDIRECTS = 3`, each hop re-validated).
   2. Validates response content-type against `ALLOWED_INLINE_IMAGE_TYPES`.
   3. `storageId = await ctx.storage.store(blob)`.
   4. Replaces the node's `src` with the resolved Convex URL and sets `storageId`.
   5. On any failure (network, content-type, size, SSRF reject, redirect overflow): logs via `console.warn`, records the failure, leaves the node unchanged, continues.
7. Action calls internal mutation `_patchInlineImageBody({ postId, body: rewrittenBody })`. **Embedding regeneration is NOT triggered** — the text extractor (`embeddings/textExtractor.ts:24-33`) skips image nodes entirely, so the body rewrite changes no extracted text. This is documented as an explicit local exception to the "all body changes go through `update`" pattern.
8. UI shows "imported N of M images" with per-image failure detail; user manually publishes when satisfied. If any inline import failed, the post stays draft and the UI surfaces which images need attention.

**Cron sweep:**

1. Every 24 hours, cron fires `sweepOrphanedStorage` (`internalMutation`).
2. Mutation queries `_storage` system table: `ctx.db.system.query("_storage").withIndex("by_creation_time", q => q.lt("_creationTime", now - ORPHAN_GRACE_MS))` (no `.filter()` — see FR-10).
3. Builds `referenced: Set<Id<"_storage">>` by:
   - Iterating all articles → adding `coverImageStorageId` and every storageId from `extractInlineImageStorageIds(body)`.
   - Iterating all posts → same.
   - Iterating all users → adding any avatar `_storage` IDs.
4. For each candidate not in `referenced`: `ctx.storage.delete(id)`.
5. If page hits 200 entries, `ctx.scheduler.runAfter(0, internal.crons.sweepOrphanedStorage, { cursor })`.

**Trust boundaries:**
- Client → server: client sends body JSON; server re-walks it (does not trust client-claimed `storageId` for cleanup decisions).
- External URL → server: best-effort IP-blocklist SSRF guard at the only entry point (`safeFetchImage`); **not resistant to DNS rebinding** (NFR-01).
- Auth → mutations: `authMutation` wrapper enforces a session.
- **Presigned upload URL model (write):** `ctx.storage.generateUploadUrl()` returns a 1-hour-TTL signed URL that anyone holding it can POST to. The `authMutation` gate prevents URL generation by unauthenticated users, but a leaked URL allows arbitrary upload by anyone in the TTL window. Mitigations: (a) short TTL, (b) cron sweep collects any blob that never gets referenced. Storage cost is the only risk; no data-integrity or auth-bypass risk.
- **Read-side URL resolution model:** `getArticleInlineImageUrl` and `getPostInlineImageUrl` are `authQuery` — any authenticated user can pass any `Id<"_storage">` and receive a fresh signed URL for it (no ownership check). **This is an explicit accepted trade-off**, justified by: (a) Mirror's article bodies are predominantly publicly readable, so most inline image URLs are already accessible to any reader of a published article; (b) storageIds are random tokens, not predictable — an attacker cannot enumerate them; (c) the practical attack (extract storageId from a draft article body) requires already having read access to the body, which means the image was already accessible. For these reasons we do NOT add a per-call ownership check. If Mirror later supports private articles with stronger visibility rules, this query must be revisited and an ownership check added.

### 3. Why this works

- **Invariant preserved:** every Convex blob in `_storage` is either (a) referenced by exactly one article/post/user record OR (b) younger than `ORPHAN_GRACE_MS`. The body-walk + cron sweep enforce this. Cover images already obey this invariant; this spec extends it to inline images without changing the rule.
- **Bug class made impossible:** _silent signed-URL expiry_ — research surfaced this as a real production failure mode (Tiptap discussion #4208, MacArthur Notion post). Resolving `src` from `storageId` at query time means a URL refresh is one query away — no document body needs rewriting.
- **Bug class made much harder:** _orphan accumulation_. Two independent mechanisms (synchronous content-diff + daily cron sweep) cover the two failure modes (live-edit removal vs abandoned drafts). Either alone leaves a known gap; together they close it.
- **Bug class avoided by design:** Plane's URL-keyed-`Set` duplicate-reference bug. We diff a multiset of `storageId` values, not URLs, and we count occurrences, so the same image appearing twice in the body and being removed once does not trigger a delete.
- **Existing behavior unchanged:** cover image lifecycle for both surfaces continues to work bit-identically; we only add the inline-image cascade alongside. Article and post `update`/`remove` callers don't change shape — they just pass body as before. Legacy bodies with external-URL `src` and no `storageId` continue to render (FR-05's fallback).
- **Compounding choice:** the sanitizer, body-walk, safe-fetch, and storage-policy modules are reusable for any future blob-bearing node type (video, file embed). Picking the `storageId`-in-node pattern over raw-URL-only avoids the second migration the research called out.

**Alternatives considered:**

| Option | Tradeoff | Rejected because |
| --- | --- | --- |
| Raw URL only in `src` (no `storageId`) — every OSS Tiptap project does this | Simplest implementation; no schema/sanitizer changes | Documented production breakage from signed-URL expiry (Tiptap #4208, MacArthur). Inconsistent with existing cover-image pattern, creating two divergent storage models in the same body. Long-term cost of CDN migration would be a full-table body rewrite. |
| Denormalized `inlineImageStorageIds: v.array(v.id("_storage"))` field on articles/posts table | O(1) cascade delete; no body-walk at delete time | Two sources of truth (the array and the body) drift under bugs; user explicitly chose body-walk over denormalization. For personal-blog scale this is fast enough. |
| `appendTransaction` diff plugin (Plane pattern) — fire delete on every edit | Real-time orphan cleanup with no save dependency | URL-keyed bug, undo-causes-delete issue, transaction-skip-flag complexity (Plane PR #5748), all unresolved. Save-time content diff covers the same case more simply for non-collab editing. |
| Store presigned URLs at upload time and cache them in the body | One less query on render | URL TTL forces background refresh logic; defeats the point of `storageId`. |
| Skip markdown image import (Mode B) — render external URLs as-is, untracked | Smaller PR; no SSRF surface | User explicitly chose Mode A. Leaves the same orphan class the rest of the spec is solving for. |

### 4. Edge cases and gotchas

- **Concurrency: same blob duplicated in body, then one occurrence removed.** Multiset (counting) diff handles this correctly. **Test:** unit test for `extractInlineImageStorageIds` + diff helper with duplicates (FR-06 verification).
- **Concurrency: two `update` mutations interleaving.** Non-issue — Convex mutations are serialized transactions; the second invocation reads the body written by the first. Documented for future reader.
- **Concurrency: cron sweep races with an in-flight upload.** A blob uploaded 23 hours ago and just now referenced is safe (grace period > Convex upload URL 1-hour expiry). A blob uploaded 25 hours ago that the user is _about_ to insert into a body would be deleted by the sweep — but the upload URL is also expired by then, so this case can't happen in practice. The grace period must be strictly greater than the upload URL TTL (1h) plus reasonable client retry (several minutes); 24h is comfortably over.
- **Concurrency: cron sweep races with an `update` mutation.** Sweep reads referenced set at time T0, mutation patches body at T1 > T0, sweep deletes at T2 > T1. If a newly-orphaned-by-mutation blob is older than 24h AND was already in the candidate set at T0, it is still correctly deleted (it's now actually orphaned). If a still-referenced blob's referenced bit was correctly read at T0, it stays. If the mutation introduces a NEW reference to an old blob between T0 and T2, the sweep's stale referenced-set could delete it — accepted because the user just-now-uploading a 24-hour-old blob is impossible (upload URL expired). Convex mutation serialization rules out simultaneous patch + delete on the same row.
- **Concurrency: two paste events fire ~200ms apart.** Each gets a fresh object-identity `id`; `findPlaceholder` is keyed by identity, not position, so resolutions don't collide. NFR-05 covers this.
- **Concurrency: editor unmounts mid-upload.** Plugin's `view.dom.isConnected` guard at dispatch time prevents crashes. Blob (if POST already started) gets stored, becomes orphaned, collected by cron. NFR-05.
- **Failure: upload network error mid-upload.** Plugin removes the placeholder and surfaces a toast. The blob may still exist in storage if the POST partially completed; the cron sweep collects it.
- **Failure: user deletes the placeholder region while upload is in flight.** `findPlaceholder` returns `null`; plugin discards. Blob (if upload ultimately succeeds) is collected by cron.
- **Failure: markdown image fetch hits a 404, SSRF block, or content-type reject.** Action records the failure, leaves `src` unchanged, continues. Post stays in `draft` (already enforced — never published with unprocessed external URLs). User sees per-image failure list and decides whether to fix or remove the broken images before publishing.
- **Failure: SSRF redirect chain depth > 3.** Rejected; same skip-and-continue.
- **Failure: `ctx.storage.delete(id)` on an already-deleted ID.** Convex returns silently; treat as no-op (matches existing cover-image cleanup).
- **Boundary: empty body.** Returns `[]`. Diff empty. No-op.
- **Boundary: legacy article with external-URL inline images.** `storageId` undefined; `update` diff treats as untracked; cron sweep ignores (no Convex blob); render keeps the URL.
- **Boundary: image node missing both `src` and `storageId`.** Sanitizer + render fall through; nothing visible. Matches stock extension.
- **Boundary: malicious body with thousands of image nodes.** Body-walk O(n) bounded by Convex's 1 MiB document limit. NFR-06 caps deletes at 50/invocation; excess waits for cron — prevents mutation budget exhaustion.
- **Migration: existing posts with pre-feature external URLs in markdown imports.** Out of scope (non-goals); they continue to work as legacy external URLs.
- **Rollout: cron sweep first run will scan a populated `_storage` table.** Pagination (NFR-02) bounds each invocation. The first run may delete pre-existing untracked orphans (failed cover uploads, test fixtures, etc.). **Verification step before merge:** run `grep -r 'v.id("_storage")' packages/convex/convex/` and confirm every result corresponds to a referenced-set source in `sweepOrphanedStorage`. The PR description must call out the first-run cleanup impact.
- **Surprise: `ctx.storage.getUrl(storageId)` returns `null` when blob is gone.** Query-time fallback: leave `src` empty. `<img>` fails to load locally — better than 500ing the whole article.
- **Surprise: query-time URL rewrite cost.** `getBySlug` walks every body on every read. For typical article sizes (<100 nodes) the cost is negligible. If body sizes grow significantly, a cached representation could be added later — out of scope here.
- **Authorization:** `update`, `remove`, and the inline-image `generateUploadUrl` mutations all use `authMutation`. The new diff/cascade logic runs inside the authorized scope. The markdown-import action is `internalAction` and never exposed publicly. The new `getInlineImageUrl` queries use `authQuery` to prevent unauthenticated URL probing.

### 5. Upstream artifact impact

| Artifact | Change | Rationale |
| --- | --- | --- |
| `.claude/rules/apps/mirror/articles.md` | Add a "media lifecycle" subsection naming the body-walk + storage-policy contract. | Future article work will keep introducing media types; codifying the rule prevents per-PR rediscovery. |
| `.claude/rules/apps/mirror/routing.md` | Add the new `[username]/articles/[slug]/edit` and `[username]/posts/[slug]/edit` routes to the routing table with auth classification = "Owner (server-component check; redirect on miss)". | The current routing table omits these routes; without an entry, the auth model is implicit and the next contributor will guess. |
| `.claude/rules/identifiers.md` | Add a brief note that Convex `_storage` IDs travel inside body JSON and are validated by sanitizer regex (separate from slug normalization). | The existing rule covers user-controllable identifiers; storage IDs are a different class but the "validate at the trust boundary" principle is the same. |
| `.claude/rules/convex.md` | Add a "blob lifecycle" subsection: every `v.id("_storage")` field MUST have synchronous delete-on-replace and delete-on-cascade semantics, plus a sweep cron. | This is the load-bearing rule the spec encodes. Without it, the next blob-bearing field will recreate the same gap. |
| `packages/convex/convex/_generated/ai/guidelines.md` | Defer (Convex's tooling owns this file via `npx convex ai-files install`). Submit upstream guidance to convex-helpers if pattern stabilizes. | Avoid drift between locally-edited guidelines and tool-managed file. |
| `apps/mirror/lib/media-policy.ts` (new) | Lift inline `MAX_COVER_IMAGE_BYTES`/`ALLOWED_COVER_IMAGE_TYPES` constants from `markdown-upload-dialog-connector.tsx:9-14` and `cover-image-picker.tsx:5`. | Three duplicates today; this spec adds a fourth use site (inline image), so consolidation pays off now. |
| `packages/convex/package.json` | New `exports` and `typesVersions` entries for the three new `content/` modules. | Already mandated by `.claude/rules/identifiers.md` for any cross-package Convex utility. |

## Unit Tests

| Test File | Test Case | Verifies |
| --- | --- | --- |
| `packages/features/editor/__tests__/inline-image-extension.test.ts` | Extension exposes `storageId` attribute with `parseHTML(data-storage-id)` and `renderHTML({"data-storage-id": ...})`. | FR-01 |
| `packages/features/editor/__tests__/inline-image-extension.test.ts` | Extension preserves `storageId` through HTML→JSON→HTML round-trip. | FR-01 |
| `packages/features/editor/__tests__/inline-image-upload-plugin.test.ts` | `paste` event with image file inserts a `Decoration.widget`. | FR-03 |
| `packages/features/editor/__tests__/inline-image-upload-plugin.test.ts` | Resolved upload replaces placeholder with image node carrying `storageId` and `src`. | FR-03 |
| `packages/features/editor/__tests__/inline-image-upload-plugin.test.ts` | Two concurrent uploads each replace their own placeholder. | NFR-05 |
| `packages/features/editor/__tests__/inline-image-upload-plugin.test.ts` | If user deletes placeholder region during upload, no node inserted; transaction discards. | FR-03 |
| `packages/features/editor/__tests__/inline-image-upload-plugin.test.ts` | On upload error, placeholder removed; no node inserted. | FR-03 |
| `packages/features/editor/__tests__/inline-image-upload-plugin.test.ts` | Editor view detached (`view.dom.isConnected === false`) during async upload — plugin no-ops on dispatch; no throw. | NFR-05 |
| `packages/features/editor/__tests__/sanitize-storage-id.test.ts` | Image node with valid `storageId` (lowercase alphanum) survives sanitization. | FR-04 |
| `packages/features/editor/__tests__/sanitize-storage-id.test.ts` | Image node with `storageId="<script>alert(1)</script>"` has the attribute stripped. | FR-04 |
| `packages/convex/convex/content/__tests__/body-walk.test.ts` | `extractInlineImageStorageIds` returns empty for empty doc. | FR-06 |
| `packages/convex/convex/content/__tests__/body-walk.test.ts` | Returns all storageIds from nested image nodes (paragraph, heading, blockquote children). | FR-06 |
| `packages/convex/convex/content/__tests__/body-walk.test.ts` | Returns duplicates as duplicates (multiset semantics) when same blob appears twice. | FR-06 |
| `packages/convex/convex/content/__tests__/body-walk.test.ts` | Skips image nodes lacking `storageId`. | FR-06 |
| `packages/convex/convex/content/__tests__/body-walk.test.ts` | `mapInlineImages` rewrites every image node and preserves tree shape. | FR-08 |
| `packages/convex/convex/content/__tests__/safe-fetch.test.ts` | Rejects `http://` URL (not https). | NFR-01 |
| `packages/convex/convex/content/__tests__/safe-fetch.test.ts` | Rejects `https://localhost`, `https://127.0.0.1`, `https://10.0.0.1`, `https://[::1]`. | NFR-01 |
| `packages/convex/convex/content/__tests__/safe-fetch.test.ts` | Rejects redirect chain landing on private IP. | NFR-01 |
| `packages/convex/convex/content/__tests__/safe-fetch.test.ts` | Rejects `Content-Length: 6291456` (6 MB) before reading. | NFR-01 |
| `packages/convex/convex/content/__tests__/safe-fetch.test.ts` | Aborts when streamed bytes exceed 5 MiB even with no Content-Length. | NFR-01 |
| `packages/convex/convex/content/__tests__/safe-fetch.test.ts` | Rejects content-type `image/gif`. | FR-11 |
| `packages/convex/convex/content/__tests__/safe-fetch.test.ts` | Times out at 10s on slow response. | NFR-01 |
| `packages/convex/convex/content/__tests__/safe-fetch.test.ts` | Successfully returns a 4 MB PNG. | NFR-01 |
| `packages/convex/convex/articles/__tests__/inline-images.test.ts` | `generateArticleInlineImageUploadUrl` returns a URL when authed. | FR-02, FR-12 |
| `packages/convex/convex/articles/__tests__/inline-images.test.ts` | `generateArticleInlineImageUploadUrl` throws when not authed. | FR-12 |
| `packages/convex/convex/articles/__tests__/inline-images.test.ts` | `getArticleInlineImageUrl` returns URL for valid storageId, null for missing, throws when not authed. | FR-02, FR-12 |
| `packages/convex/convex/articles/__tests__/inline-images.test.ts` | `update` removes 1 storageId blob when one of two distinct images is deleted. | FR-06 |
| `packages/convex/convex/articles/__tests__/inline-images.test.ts` | `update` removes 0 blobs when one duplicate of a duplicated image is removed (multiset). | FR-06 |
| `packages/convex/convex/articles/__tests__/inline-images.test.ts` | `update` deletes inline blobs AFTER `db.patch` succeeds (ordering test). | FR-06 |
| `packages/convex/convex/articles/__tests__/inline-images.test.ts` | `update` with 60 removed inline storageIds deletes 50 in-mutation; remaining 10 deleted by next cron run. | NFR-06 |
| `packages/convex/convex/articles/__tests__/inline-images.test.ts` | `remove` with 60 inline storageIds deletes 50 in-mutation; remaining deleted by cron. | NFR-06 |
| `packages/convex/convex/articles/__tests__/inline-images.test.ts` | `remove` deletes 3 inline blobs + 1 cover blob for an article with that media. | FR-07 |
| `packages/convex/convex/articles/__tests__/inline-images.test.ts` | `remove` skips inline blobs that have no `storageId`. | FR-07 |
| `packages/convex/convex/articles/__tests__/inline-images.test.ts` | `importMarkdownInlineImages` action: external URL → fetched blob stored, body patched with new `storageId`. | FR-08 |
| `packages/convex/convex/articles/__tests__/inline-images.test.ts` | `importMarkdownInlineImages`: 404 on URL → original `src` preserved, action does not throw. | FR-08 |
| `packages/convex/convex/articles/__tests__/inline-images.test.ts` | `importMarkdownInlineImages`: skips images that already have a `storageId` (idempotent). | FR-08 |
| `packages/convex/convex/posts/__tests__/inline-images.test.ts` | All of the above, mirrored for posts. | FR-02, FR-06, FR-07, FR-08, FR-12 |
| `packages/convex/convex/articles/__tests__/queries.test.ts` (new) | `getBySlug` rewrites image node `src` to a Convex-served URL when `storageId` is set. | FR-05 |
| `packages/convex/convex/articles/__tests__/queries.test.ts` (new) | `getBySlug` leaves `src` untouched when `storageId` is absent. | FR-05 |
| `packages/convex/convex/articles/__tests__/queries.test.ts` (new) | `getByUsernameForConversation` returns body verbatim — no URL rewrite (FR-05 articles-only exemption). | FR-05 |
| `packages/convex/convex/posts/__tests__/queries.test.ts` (new) | `getBySlug` rewrites image node `src` to a Convex-served URL when `storageId` is set. | FR-05 |
| `packages/convex/convex/posts/__tests__/queries.test.ts` (new) | `getBySlug` leaves `src` untouched when `storageId` is absent. | FR-05 |
| `packages/convex/convex/content/__tests__/orphan-sweep.test.ts` | Sweep deletes orphans older than `ORPHAN_GRACE_MS` and not referenced by any record. | FR-10 |
| `packages/convex/convex/content/__tests__/orphan-sweep.test.ts` | Sweep skips orphans younger than `ORPHAN_GRACE_MS`. | FR-10 |
| `packages/convex/convex/content/__tests__/orphan-sweep.test.ts` | Sweep skips referenced blobs (cover, inline, avatar). | FR-10 |
| `packages/convex/convex/content/__tests__/orphan-sweep.test.ts` | Sweep paginates: 500 candidates → multiple invocations via `runAfter`, all deleted. | NFR-02 |
| `packages/convex/convex/content/__tests__/orphan-sweep.test.ts` | Sweep query uses `withIndex("by_creation_time", q => q.lt(...))` and not `.filter()` — assert by inspecting the function body or by behavior on a populated table. | FR-10 |
| `packages/convex/convex/content/__tests__/orphan-sweep.test.ts` | **Schema-introspection regression test:** programmatically enumerate every `v.id("_storage")` field in the Convex schema; assert that the sweep handler reads each one into its referenced set. Adding a new storage-bearing field without updating the sweep must fail this test. | FR-10 |
| `apps/mirror/features/posts/lib/parsers/__tests__/markdown-to-json-content.test.ts` (new) | Markdown `![alt](https://x/y.png)` produces `image` node with that `src` and no `storageId`. (Co-located with the parser per the convention established by `parse-md-frontmatter.test.ts` in the same directory.) | FR-09 |
| `apps/mirror/features/posts/__tests__/use-create-post-from-file.test.ts` (new or extended) | After `importMarkdownInlineImages` action completes successfully, post status remains `draft` (not auto-published). User must manually publish. | FR-08 |
| `apps/mirror/features/articles/__tests__/use-article-inline-image-upload.test.ts` | Hook rejects file with disallowed MIME before calling mutation. | FR-11 |
| `apps/mirror/features/articles/__tests__/use-article-inline-image-upload.test.ts` | Hook rejects file > 5 MiB before calling mutation. | FR-11 |

## Adversarial Review Summary

**Final stop reason:** quality bar met after two adversarial passes (no Critical concerns remain; all Important concerns from both passes resolved or explicitly accepted).

### Pass 1 (16 concerns)

| Concern | Severity | Resolution |
| --- | --- | --- |
| URL resolution after upload was architecturally underdetermined; "useQuery cached" is wrong semantics for one-shot async | Critical | **Accepted** — added `getArticleInlineImageUrl` / `getPostInlineImageUrl` public queries; hook calls them imperatively via `convexClient.query(...)`. FR-02 + data flow updated. Second round-trip is documented as the cost of the storageId-in-node design. |
| Cron sweep used `.filter()` in violation of `.claude/rules/convex.md` | Critical | **Accepted** — rewrote as `.withIndex("by_creation_time", q => q.lt("_creationTime", cutoff))` in FR-10 + data flow. Added unit test that asserts no `.filter()` use. |
| Cover-image ordering change in articles risked breaking existing `mutations.test.ts` | Critical | **Accepted with scope reduction** — reverted the proposed cover-image ordering change. Articles cover-image keeps current delete-before-patch behavior. Inline images use the after-patch ordering (matches posts). The intra-mutation inconsistency is documented as a known minor follow-up — not in scope here. |
| Article edit page does not exist; E2E tests have no UI surface | Critical | **Accepted** — added `apps/mirror/app/[username]/articles/[slug]/edit/page.tsx` and post equivalent (plus `_components/` client components) to "Files to create". Owner-only; mounts `RichTextEditor`. |
| FR-05 didn't address `getByUsernameForConversation` | Important | **Accepted** — FR-05 now explicitly exempts the conversation query with rationale (text extractor skips images). Test added. |
| DNS-rebinding TOCTOU in SSRF guard | Important | **Accepted with downgraded claim** — NFR-01 now explicitly says "best-effort IP-blocklist, NOT resistant to DNS rebinding"; full resolve-then-bind-IP fix is out of scope for personal-blog risk profile. `MAX_FETCH_REDIRECTS = 3` constant lifted to `storage-policy.ts`. |
| Sanitizer regex `/^[a-z0-9]+$/` assumed Convex ID format | Important | **Accepted** — relaxed to `/^[a-zA-Z0-9_-]+$/` for XSS prevention only; not a format guarantee. Documented that Convex's `_storage` ID character set is not contractually stable. |
| `_patchInlineImageBody` sibling mutation bypasses embedding regen | Important | **Accepted with explicit rationale** — kept the sibling mutation but documented the deliberate skip: text extractor explicitly excludes image nodes (`embeddings/textExtractor.ts:24-33`), so image-only body rewrites change no extracted text and embedding regen would be wasted work. FR-08 + data flow updated with this rationale. |
| Markdown imports briefly visible with external URLs (privacy / tracker pixels) | Important | **Accepted** — markdown imports now force `status: "draft"` regardless of front-matter; user manually publishes after image processing. FR-08 + data flow updated. |
| `queries.test.ts` labeled "(extend existing)" but doesn't exist | Important | **Accepted** — relabeled "(new)" for both surfaces. |
| Cron sweep paginates `_storage` but not article/post walk | Important | **Accepted with scope assumption** — NFR-02 documents <1000 articles+posts ceiling and adds a header comment requirement to the cron file. If scope grows, sweep must be re-architected. |
| Plugin async resolution + editor unmount edge case | Important | **Accepted** — added `view.dom.isConnected` guard requirement (NFR-05), edge case row, and unit test. |
| Presigned upload URL trust model not acknowledged | Important | **Accepted** — added explicit trust-boundaries note. |
| First-run sweep deletes pre-feature orphans / unverified `v.id("_storage")` exhaustiveness | Minor | **Accepted** — FR-10 now mandates a pre-merge `grep -r 'v.id("_storage")'` verification step; PR description must call out first-run impact. |
| `v.any()` body with thousands of image nodes could exhaust mutation budget | Minor | **Accepted** — added NFR-06: cap of 50 inline storage deletes per `update` / `remove` invocation; excess deferred to cron sweep. Tests added. |
| Concurrent `update` mutation race | Non-issue | **Rejected** — Convex serializes mutations; multiset diff is correct. Documented in edge cases for future readers. |

### Pass 2 (10 concerns surfaced after Pass 1 resolution)

| Concern | Severity | Resolution |
| --- | --- | --- |
| `getByUsernameForConversation` exists only for articles, not posts; FR-05 and "mirror to posts" instruction were broken | Critical | **Accepted** — FR-05 reworded to scope the conversation-query exemption to articles only; posts test mirror explicitly omits the conversation case. |
| FR-10 requirement said `.withIndex(...)` but data-flow narrative still said `.filter()` (intra-document contradiction) | Important | **Accepted** — fixed the data-flow narrative to match FR-10. |
| `authQuery` on `getInlineImageUrl` allows any authed user to resolve any `storageId` to a signed URL | Important | **Accepted as explicit trust trade-off** — added a "read-side URL resolution model" paragraph to trust boundaries documenting the threat-model rationale (storageIds are non-enumerable random tokens; published bodies are publicly readable anyway; private-article support would require revisiting). No ownership check added. |
| "Each hop re-validated" was ambiguous between DNS-resolve check and URL-string check | Important | **Accepted** — NFR-01 now explicitly mandates DNS resolution + IP blocklist re-check on every redirect hop; tests updated. |
| Manual `grep v.id("_storage")` is a one-time gate, not a regression barrier | Important | **Accepted** — added a schema-introspection regression test in `orphan-sweep.test.ts` that programmatically enumerates every `v.id("_storage")` field and asserts sweep coverage; manual grep is now backed by an automated check that fails on regressions. |
| Edit pages' auth boundary unspecified vs middleware that allows `/@username/*` for unauthed users | Important | **Accepted** — edit pages are now spec'd as server components performing the ownership/auth check with `redirect("/sign-in")` on miss; routes added to `.claude/rules/apps/mirror/routing.md` upstream-artifact change. |
| "Force draft regardless of front-matter" tested a property that was already true; missed the actual risk | Minor | **Accepted** — test rewritten to verify "post stays draft after `importMarkdownInlineImages` completes successfully" — the actual behavior this PR could regress. |
| NFR-06 cap leaves orphans visible in storage for up to 24h | Minor | **Non-issue** — confirmed via Convex dashboard: no real-time orphan metric that would alarm; size of the limbo set is bounded by mutation cap. No spec change. |
| Edit-page UX (autosave, unsaved-changes warning, cancel, etc.) is unspecified | Minor | **Non-issue for this spec** — explicitly listed as out of scope in the edit-page client-component file description; flagged for product follow-up. Pages remain thin enough for E2E tests to interact. |
| `withIndex` + `.lt()` on `_storage` system table — implementability | Non-issue | **Confirmed supported** — verified against `convex@1.32.0` types; system tables expose `by_creation_time` index. Documented for future readers. |
