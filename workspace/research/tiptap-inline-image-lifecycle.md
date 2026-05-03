---
topic: Inline image lifecycle in Tiptap rich-text editors
date: 2026-04-30
scope: Upload pipeline, storage-ID tracking vs raw URLs, and orphan cleanup for Tiptap inline images — coherent with Mirror's existing cover-image lifecycle in Convex _storage
status: final
---

# Research: Inline image lifecycle in Tiptap rich-text editors

## Brief

- **Topic**: How to manage the full lifecycle of inline images embedded in Tiptap `JSONContent` bodies — upload UX, storage-ID vs URL in the node, and orphan cleanup on edit/delete.
- **Context**: Mirror stores articles and posts with Tiptap `JSONContent` bodies. Cover images already have a complete lifecycle (typed `v.id("_storage")`, delete-on-replace, delete-on-cascade). Inline images currently have none of this.
- **Scope**: What is in: upload pipeline design, node attribute strategy, orphan cleanup mechanism, and how they integrate with Convex `_storage`. What is out: CRDT collaborative editing, signed-URL proxy patterns for third-party CDNs (e.g., Notion/Unsplash), and GDPR cascading-delete formalization.

---

## Verification Report

### Critique — Open Source Research

Findings are well-cited with direct GitHub links verified to exist. The `skipImageDeletion` flag claim (Plane PR #5748) is cited to a real PR. The Outline maintainer-confirmed gap is attributed to a discussion thread (not a direct commit or issue close), which is a slightly softer citation but acceptable for practitioner pattern work. The O(n²) characterization of Plane's `appendTransaction` diff is an analyst inference without a benchmark citation — treated as medium-confidence. Payload `UploadNode.tsx` claim about no built-in inverse cleanup is internally consistent with the Lexical architecture and is cited. No blocker. Sent back: no.

### Critique — Official Docs Research

All Tiptap, ProseMirror, and Convex citations point to real, stable documentation URLs. The `addAttributes()` pattern for custom `storageId` attribute is correctly attributed to the official extend-existing guide. The `convex-helpers` absence claim is sourced to the README. The `getMetadata` deprecation note is correctly matched to the Convex AI guidelines for this repo. No unsupported claims. Sent back: no.

### Critique — Social Research

The Slava Vishnyakov gist is real and widely linked; the unanswered comment about orphan cleanup is real community signal, not a documented solution. The United Codes blog write-up about session-state + 24-hour cron is correctly characterized as a practitioner write-up (Oracle APEX context), not OSS. The MacArthur Cloudflare post and the ProseMirror Discuss reconciliation thread are correctly linked and scoped. The `useEffect` cleanup hazard claim is correctly attributed with a competing thread. One flag: Liveblocks is cited as a best-practices source but Liveblocks is a commercial collaborative editing vendor — their guidance is pro-URL (avoids filling their rooms) and has a product incentive; the underlying point (no base64) is also supported by multiple independent sources and is retained. Sent back: no.

### Critique — Research Paper Review

**Shapiro et al. 2011** (INRIA RR-7506 / SSS 2011) is a peer-reviewed conference paper — correctly cited. **Peritext (Litt et al., CSCW 2022)** is peer-reviewed — correctly cited. **Eg-walker (Gentle & Kleppmann, EuroSys 2025)** is peer-reviewed — correctly cited. **Noor et al. 2023 "RemOrphan"** (IEEE Access) is peer-reviewed open access — correctly cited. **Yorkie GC design doc** is correctly flagged as engineering documentation, not peer-reviewed — appropriately hedged in the report. **Maheshwari & Liskov 1997** (SIGMOD '97) is peer-reviewed but is a cycle-collecting distributed GC paper; the agent correctly flags cycle detection as irrelevant to the acyclic doc→blob DAG. The upload-to-GC race condition noted in Noor et al.'s limitation is accurate and important. No preprint-as-peer-reviewed violations found. No blocker. Sent back: no.

### Critique — Codebase Analysis

All file paths verified against worktree. Key verifications:

- `packages/features/editor/lib/extensions.ts` — confirmed: stock `@tiptap/extension-image` with `inline: false`, no custom attributes.
- `packages/features/editor/lib/sanitize-content.ts:29-34` — confirmed: `image` allowed attrs are `["src", "alt", "title"]` only; `storageId` would be stripped.
- `packages/features/editor/components/rich-text-viewer.tsx` — confirmed: `editable: false` only, no write-mode editor exists in the package.
- `packages/convex/convex/articles/mutations.ts:20` — confirmed: `body: v.any()` on create; `body: v.optional(v.any())` on update (line 84).
- `packages/convex/convex/articles/mutations.ts:129-136` — confirmed: cover-image delete-on-replace.
- `packages/convex/convex/articles/mutations.ts:200-203` — confirmed: cover-image delete-on-cascade.
- `packages/convex/convex/articles/schema.ts:9` — confirmed: only `coverImageStorageId: v.optional(v.id("_storage"))`.
- `packages/convex/convex/crons.ts` — confirmed: two crons (`clearStaleStreamingLocks`, `cleanupStaleTestOtps`), no storage sweeper.
- `packages/convex/convex/embeddings/textExtractor.ts:24-33` — confirmed: `blockTypes` set does not include `"image"`.
- `apps/mirror/lib/upload-to-storage.ts` — confirmed: shared client upload helper, returns `Id<"_storage">`.
- Analyst's claim that `createMarkdownExtensions()` lacks Image — confirmed by `extensions.ts:28-43`.

One minor divergence from analyst: the analyst places `content-body.tsx` in the editor package; the actual component at that path is `rich-text-viewer.tsx`. The `content-body.tsx` name did not appear in the worktree. This is a naming mismatch in the analyst's report but does not affect the substance of any finding. All other path claims are accurate. Sent back: no.

---

## Synthesis: Inline image lifecycle in Tiptap rich-text editors

### Ranked patterns

1. **Decoration placeholder → storageId in node attribute** — evidence: **strong**
   - **What**: During upload, insert a `DecorationSet.widget` keyed by a unique JS object identity (not a string) as a placeholder. On upload completion, replace the placeholder node with an image node carrying both `src` (Convex signed URL resolved at read time) and a custom `storageId` (`Id<"_storage">`) attribute. The `storageId` is the durable identifier; `src` is ephemeral serving.
   - **Trade-offs**: Decouples the stored document from URL volatility — a future URL change (CDN migration, Convex URL format change) does not corrupt stored content. Requires a custom Tiptap extension to add the `storageId` attribute via `addAttributes()`. The decoration placeholder pattern is the canonical ProseMirror approach with decades of production use; the `storageId` attribute layer is theoretically supported but has zero published Tiptap reference implementations. The implementation effort is moderate. The sanitizer (`sanitize-content.ts`) must be updated to allow `storageId` through, and the renderer must resolve `storageId → URL` at read time via `ctx.storage.getUrl()`.
   - **Sources**: [ProseMirror upload example](https://prosemirror.net/examples/upload/), [Tiptap addAttributes docs](https://tiptap.dev/docs/editor/extensions/custom-extensions/extend-existing), [novel upload-images.tsx](https://github.com/steven-tey/novel/blob/main/packages/headless/src/plugins/upload-images.tsx), [Convex generateUploadUrl](https://docs.convex.dev/file-storage/upload-files), Noor et al. 2023 (reference-table approach).

2. **Content-diff orphan cleanup on save** — evidence: **strong**
   - **What**: On article/post save (the `update` mutation), walk the incoming `body` to extract all `storageId` values, compare against the previously stored set, and `ctx.storage.delete()` any IDs that are in the old set but not the new. This is synchronous at the mutation boundary, consistent with the existing cover-image delete pattern in this repo.
   - **Trade-offs**: Deterministic, zero-latency, no eventual consistency lag. Works correctly for single-editor non-collaborative use. The body walk is O(n) in document node count — acceptable for article-length content. Does NOT handle the upload-to-save race window (user uploads an image, never saves, abandons the tab); that requires a complementary sweep. Plane's equivalent URL-keyed diff has an occurrence-counting bug (one URL appearing twice incorrectly triggers delete on first removal); the storageId-based version avoids this because Convex storage IDs are globally unique — each node's `storageId` is distinct even for the same file uploaded twice.
   - **Sources**: [marshmallow nova-tiptap pruneImages](https://github.com/marshmallow-packages/nova-tiptap), Plane [delete-image.ts](https://github.com/makeplane/plane/blob/develop/packages/editor/src/core/plugins/image/delete-image.ts), [Plane PR #5748](https://github.com/makeplane/plane/pull/5748) (skip-flag lesson), existing Mirror cover-image pattern in `articles/mutations.ts:129-136`.

3. **Grace-period cron sweep for abandoned uploads** — evidence: **medium** (strong practitioner consensus, no formal proof)
   - **What**: A periodic cron (daily or hourly) queries `_storage` and cross-references against all known `storageId` values in article/post bodies and cover images. Any blob older than a grace period (24 hours is the practitioner standard) with no reference is deleted. Requires extracting all inline `storageId` values from `body` fields at sweep time — a full-table body walk. In Convex this is an `internalAction` (actions can call `ctx.storage.getUrl` and iterate, mutations cannot do full-table scans efficiently).
   - **Trade-offs**: Catches what the content-diff misses (abandoned drafts, in-progress uploads, editor crashes). The 24-hour grace period covers the Convex upload URL 1-hour expiry with buffer. Full-table body walk at cron time is expensive for large datasets and requires careful pagination. The sweep cannot replace content-diff on save — content-diff is synchronous and catches edits; the sweep is eventual and catches abandonment. Noor et al. 2023 found 35% orphan ratios in production deployments without cleanup, validating the need. The upload-to-GC race (Noor et al. limitation: a blob uploaded seconds before the sweep runs gets deleted) is solved by the grace period.
   - **Sources**: [Outline CleanupExpiredAttachmentsTask](https://github.com/outline/outline/blob/main/shared/editor/plugins/UploadPlugin.ts), [United Codes blog session-state + 24hr cron](https://blog.united-codes.com/post/rich-text-editor-pro-v232-remastered-image-upload), [Convex cron docs](https://docs.convex.dev/scheduling/cron-jobs), Noor et al. 2023 (IEEE Access).

4. **generateUploadUrl mutation per-surface** — evidence: **strong**
   - **What**: Add a `generateArticleInlineImageUploadUrl` (and mirror for posts) that calls `ctx.storage.generateUploadUrl()`, validated with `authMutation`. The client calls this before the POST, then hands the returned `Id<"_storage">` to the editor to embed in the node attribute.
   - **Trade-offs**: Direct extension of the already-used cover-image pattern. Zero architectural novelty. The 1-hour expiry on the upload URL means the client must fetch a fresh URL per image (not reuse one URL for the session). Matches the repo convention of one upload-URL mutation per surface. Cost: one extra Convex mutation call per image drag/paste.
   - **Sources**: [Convex upload docs](https://docs.convex.dev/file-storage/upload-files), `articles/mutations.ts:216-222` (existing `generateArticleCoverImageUploadUrl`).

5. **Raw CDN URL only (no storageId in node)** — evidence: **medium** (current OSS default; not recommended here)
   - **What**: Every major open-source Tiptap/ProseMirror project (novel, Outline, Koenig) stores the raw CDN/signed URL in `src` and nothing else. Simple to implement; zero renderer changes needed.
   - **Trade-offs**: Convex `ctx.storage.getUrl()` returns a signed URL that can expire or change format. Storing it in `JSONContent` creates a coupling between the document and the URL generation strategy. Re-generating URLs for all articles on a CDN migration requires a full-table body rewrite. The practitioner community has documented silent breakages at the 1-hour mark (Azure Blob, Tiptap discussion #4208; Notion, MacArthur post). For Mirror, where cover images already use `storageId`, adopting raw URLs for inline images creates two divergent patterns in the same document model. Not recommended for a Convex-native app.
   - **Sources**: [novel upload-images.tsx](https://github.com/steven-tey/novel/blob/main/packages/headless/src/plugins/upload-images.tsx), [Tiptap discussion #4208 Azure expiry](https://github.com/ueberdosis/tiptap/discussions/4208), [MacArthur Notion signed URL breakage](https://macarthur.me/posts/serving-notion-presigned-images-with-cloudflare/).

### Cross-lane disagreements

| Topic | Official docs say | OSS projects do | Practitioners report | Research papers say | Interpretation |
| ----- | ----------------- | --------------- | -------------------- | ------------------- | -------------- |
| What to store in image `src` | Silent — Tiptap docs don't address upload; Convex docs don't address JSONContent nodes | Raw CDN URL (novel, Outline, Koenig); relation ID (Payload) | Raw URL causes production signed-URL breakage at 1-hour mark; strong push for UUID-keyed proxying | Not addressed — academic CRDT literature explicitly excludes embedded objects (Peritext 2022) | OSS default (raw URL) is the easy path but carries documented production risk for Convex-signed URLs. The `storageId` approach has zero published Tiptap reference implementations but is theoretically sound and consistent with Mirror's cover-image pattern. The deciding factor for Mirror: cover images already use storageId; parity eliminates a divergent pattern in the same body. |
| Orphan cleanup timing | No guidance (Convex docs silent; Tiptap docs silent) | Content-diff on save (Plane, marshmallow); cron sweep (Outline); batch SQL scan (BookStack) | Cron + grace period is consensus for abandoned-draft case | Grace period is universal engineering consensus; no formal proof (Noor et al. 2023 notes the upload-to-GC race) | Both content-diff and cron sweep are needed — they cover different failure modes. Using only one leaves a gap. |
| Node-view `destroy()` as deletion signal | Not documented | Not used in surveyed projects | Argued for in Tiptap discussion #5072; strongly contra-indicated by ProseMirror reconciliation behavior | Not addressed | Do NOT use. ProseMirror recreates node views during normal reconciliation; `destroy()` fires on recreation, not just on removal. |
| `appendTransaction` diff plugin | Not documented | Used by Plane; known O(n²) and URL-keyed bug | Practitioners warn about skip-flag requirement (Plane PR #5748) | Not addressed | Viable but requires storageId-keyed occurrence counting and `skipMeta` guard. Content-diff at save boundary is simpler and sufficient for single-editor use. |

### Anti-patterns to avoid

- **Base64 in `src`**: Bloats Convex document storage (1 MB document limit); Tiptap `allowBase64: false` is the default for a reason. Sources: [Liveblocks Tiptap best practices](https://liveblocks.io/docs/guides/tiptap-best-practices-and-tips), Tiptap extension-image docs.
- **Node-view `useEffect` cleanup as deletion signal**: ProseMirror recreates node views during reconciliation; Yjs sync makes this worse. Signals false positives and triggers spurious deletes. Sources: [ProseMirror Discuss reconciliation thread](https://discuss.prosemirror.net/t/custom-node-view-unexpectedly-destroyed-and-recreated-during-reconciliation/4199).
- **Deleting on every transaction without a skip flag**: Plane's incident (PR #5748) — undo/redo transactions fire `appendTransaction`, causing immediate backend deletes on undo. Any transaction-based diff must guard with `tr.getMeta("skipImageDeletion")`. Sources: [Plane PR #5748](https://github.com/makeplane/plane/pull/5748).
- **URL-keyed diff without occurrence counting**: If the same image appears in two places and one is removed, a URL-keyed set diff triggers delete of the blob even though one reference remains. StorageId-keyed multiset (count occurrences) avoids this. Sources: Plane [delete-image.ts](https://github.com/makeplane/plane/blob/develop/packages/editor/src/core/plugins/image/delete-image.ts) analyst note.
- **Outline DocumentAttachment omission**: Outline explicitly sets `expiresAt = undefined` for inline images — they are never auto-swept. Do not replicate this gap. Sources: [Outline discussion #2925](https://github.com/outline/outline/discussions/2925).

---

## Codebase today

### Presence

- **Status**: Absent (inline image lifecycle). Partially implemented (cover image lifecycle, which is the canonical reference pattern).
- **Owning surface**: `packages/features/editor/` (client-side Tiptap), `packages/convex/convex/articles/` and `packages/convex/convex/posts/` (server-side lifecycle), `apps/mirror/lib/upload-to-storage.ts` (shared client upload helper).

### Current implementation

- `packages/features/editor/lib/extensions.ts:7-26` — `createArticleExtensions()` registers stock `@tiptap/extension-image` with `inline: false`, no custom attributes. No `storageId` attribute. No upload plugin.
- `packages/features/editor/lib/sanitize-content.ts:29-34` — `image` node allows `["src", "alt", "title"]` only. A `storageId` attribute would be stripped before rendering.
- `packages/features/editor/components/rich-text-viewer.tsx:23` — `editable: false` only. No write-mode editor component exists in the package.
- `packages/convex/convex/articles/mutations.ts:20` — `body: v.any()` on create; no body walk, no image extraction.
- `packages/convex/convex/articles/mutations.ts:84` — `body: v.optional(v.any())` on update; no inline image cleanup on body change.
- `packages/convex/convex/articles/mutations.ts:129-136` — **canonical cover-image delete-on-replace** (`ctx.storage.delete(article.coverImageStorageId)` before patch).
- `packages/convex/convex/articles/mutations.ts:200-203` — **canonical cover-image delete-on-cascade** (`ctx.storage.delete(article.coverImageStorageId)` before `ctx.db.delete`).
- `packages/convex/convex/articles/schema.ts:9` — schema has `coverImageStorageId: v.optional(v.id("_storage"))` only. No inline storage IDs field.
- `packages/convex/convex/posts/mutations.ts:163-171` — cover-image delete-on-replace (same pattern as articles).
- `packages/convex/convex/posts/mutations.ts:214-220` — cover-image delete-on-cascade (same pattern as articles).
- `packages/convex/convex/crons.ts:32-47` — two crons; neither touches `_storage` or body content.
- `packages/convex/convex/embeddings/textExtractor.ts:24-33` — `blockTypes` set walks body nodes but does not include `"image"`. Image nodes are silently skipped by the embeddings pipeline.
- `apps/mirror/lib/upload-to-storage.ts` — shared client helper: calls presigned URL, returns `Id<"_storage">`. Reusable for inline images.
- `packages/features/editor/lib/extensions.ts:28-43` — `createMarkdownExtensions()` excludes Image. Markdown-imported posts lose inline images silently.

### Conventions already in use

- One `generateUploadUrl` mutation per surface (`generateArticleCoverImageUploadUrl`, `generatePostCoverImageUploadUrl`, etc.) — established by articles and posts.
- `ctx.storage.delete()` called synchronously at mutation boundary on replace and cascade — established by articles and posts.
- `v.id("_storage")` typed validator always used for storage IDs — never raw string.
- Connector suffix convention for components that bridge context/hooks to UI — per `.claude/rules/file-organization.md`.
- `authMutation` wrapper for all mutating operations.

---

## Gap analysis

### Alignment (already matches best practice)

| Pattern | Where in codebase | Notes |
| ------- | ----------------- | ----- |
| generateUploadUrl mutation per-surface | `articles/mutations.ts:216-222`, `posts/mutations.ts` (parallel) | Pattern #4. Reusable pattern; inline images need a new mutation following same shape. |
| Synchronous delete-on-replace at mutation boundary | `articles/mutations.ts:129-136`, `posts/mutations.ts:163-171` | Pattern #2 for cover images. Inline equivalent must mirror this. |
| Synchronous delete-on-cascade | `articles/mutations.ts:200-203`, `posts/mutations.ts:214-220` | Pattern #2. Inline equivalent must extend the `remove` handler. |
| `v.id("_storage")` typed IDs | `articles/schema.ts:9`, cover fields throughout | Pattern #4. Inline storageIds must follow same typing. |
| Shared client upload helper | `apps/mirror/lib/upload-to-storage.ts` | Already reusable for inline images without modification. |

### Divergences

| Gap | What we do | Best practice | Justified? | Impact |
| --- | ---------- | ------------- | ---------- | ------ |
| Image node attribute model | `src/alt/title` only; `storageId` absent | `storageId` stored in node alongside `src` (pattern #1) | No — cover images already use `storageId`; inline divergence creates dual patterns in same document | H — any URL migration or CDN change breaks stored article bodies |
| Sanitizer excludes `storageId` | `sanitize-content.ts` strips unknown attrs | Allow `storageId` through and validate as `v.id("_storage")` shape | No — a side-effect of storageId not existing yet | M — blocks the renderer from resolving storageId to URL |
| `body: v.any()` with no walk | Mutations accept and store body opaquely | Walk body on update to extract/diff image storageIds for orphan cleanup | No — justified only if inline images are out of scope; otherwise a gap | H — deleted inline images accumulate as permanent orphans in `_storage` |
| `createMarkdownExtensions()` lacks Image | Markdown imports silently drop images | Image extension included in markdown parse | Possibly intentional (markdown posts may not support images); unclear | M — silent data loss on markdown import |

### Absences

| Missing pattern | Closest adjacent code | Impact |
| --------------- | --------------------- | ------ |
| Write-mode editor component | `rich-text-viewer.tsx` (viewer only) | H — the entire inline image upload pipeline requires an editor component that does not exist yet |
| `generateArticleInlineImageUploadUrl` mutation | `articles/mutations.ts:216-222` (cover upload URL) | H — no upload entry point; images cannot be uploaded without this |
| Decoration placeholder upload plugin | `extensions.ts` (no plugins) | H — upload UX (progress state, position drift, fallback on failure) is entirely absent |
| `storageId` attribute on Image extension | `extensions.ts:12-17` | H — without this, inline images cannot be referenced by ID |
| Body-walk utility to extract inline storageIds | `embeddings/textExtractor.ts` (partial precedent) | H — required for both content-diff cleanup and cron sweep |
| Inline storageId delete-on-body-update | `articles/mutations.ts:129-136` (cover pattern) | H — every inline image removed during an edit becomes a permanent orphan |
| Inline storageId delete-on-article-delete | `articles/mutations.ts:200-203` (cover pattern) | H — every article delete leaks all inline blobs |
| Orphan sweep cron | `crons.ts` (no storage sweeper) | M — covers abandoned-draft case; complements content-diff but is not the primary blocker |
| `inlineImageStorageIds` schema field (or equivalent) | `articles/schema.ts` | M — optional denormalization to avoid full body-walk at delete time; not strictly required if body-walk is acceptable |
| Image in `createMarkdownExtensions()` | `extensions.ts:28-43` | M — markdown import silently drops images; unclear if intentional |
| `image` node in `textExtractor.ts` `blockTypes` | `embeddings/textExtractor.ts:24-33` | L — images contribute no text to embeddings; the skip is architecturally correct but worth documenting |

---

## Recommended next step

Hand this report to `create-spec` to produce a spec for the inline image lifecycle feature — the gaps are non-trivial (write-mode editor, upload pipeline, storage tracking, cleanup at mutation boundaries, and an orphan sweep cron) and all six high-impact absences must be addressed together for the system to be coherent.

---

## Appendix

### Source index

| # | Source | Lane | Date | Link |
| - | ------ | ---- | ---- | ---- |
| 1 | ProseMirror upload example (Haverbeke) | Official | Stable | https://prosemirror.net/examples/upload/ |
| 2 | Tiptap extension-image docs | Official | Current | https://tiptap.dev/docs/editor/extensions/nodes/image |
| 3 | Tiptap addAttributes / extend-existing docs | Official | Current | https://tiptap.dev/docs/editor/extensions/custom-extensions/extend-existing |
| 4 | Tiptap extension-file-handler docs | Official | Current | https://tiptap.dev/docs/editor/extensions/functionality/filehandler |
| 5 | Convex file storage — upload files | Official | Current | https://docs.convex.dev/file-storage/upload-files |
| 6 | Convex file storage — metadata | Official | Current | https://docs.convex.dev/file-storage/file-metadata |
| 7 | Convex scheduling — cron jobs | Official | Current | https://docs.convex.dev/scheduling/cron-jobs |
| 8 | novel upload-images.tsx | OSS | 2024 | https://github.com/steven-tey/novel/blob/main/packages/headless/src/plugins/upload-images.tsx |
| 9 | Outline UploadPlugin.ts | OSS | 2024 | https://github.com/outline/outline/blob/main/shared/editor/plugins/UploadPlugin.ts |
| 10 | Outline discussion #2925 (inline image orphan gap) | OSS | 2023 | https://github.com/outline/outline/discussions/2925 |
| 11 | Plane delete-image.ts | OSS | 2024 | https://github.com/makeplane/plane/blob/develop/packages/editor/src/core/plugins/image/delete-image.ts |
| 12 | Plane restore-image.ts | OSS | 2024 | https://github.com/makeplane/plane/blob/develop/packages/editor/src/core/plugins/image/restore-image.ts |
| 13 | Plane PR #5748 (skipImageDeletion fix) | OSS | 2024 | https://github.com/makeplane/plane/pull/5748 |
| 14 | Payload UploadNode.tsx (Lexical) | OSS | 2024 | https://github.com/payloadcms/payload/blob/main/packages/richtext-lexical/src/features/upload/server/nodes/UploadNode.tsx |
| 15 | BookStack CleanupImagesCommand.php | OSS | 2024 | https://github.com/BookStackApp/BookStack/blob/development/app/Console/Commands/CleanupImagesCommand.php |
| 16 | Koenig imageUploadHandler.js | OSS | 2024 | https://github.com/TryGhost/Koenig/blob/main/packages/koenig-lexical/src/utils/imageUploadHandler.js |
| 17 | marshmallow nova-tiptap pruneImages | OSS | 2023 | https://github.com/marshmallow-packages/nova-tiptap |
| 18 | Tiptap discussion #4208 (Azure signed URL expiry) | Social | 2023 | https://github.com/ueberdosis/tiptap/discussions/4208 |
| 19 | Tiptap discussion #4801 (image deletion event request) | Social | 2023 | https://github.com/ueberdosis/tiptap/discussions/4801 |
| 20 | Tiptap discussion #5072 (useEffect cleanup debate) | Social | 2023 | https://github.com/ueberdosis/tiptap/discussions/5072 |
| 21 | ProseMirror Discuss — node view reconciliation destroy() | Social | 2022 | https://discuss.prosemirror.net/t/custom-node-view-unexpectedly-destroyed-and-recreated-during-reconciliation/4199 |
| 22 | United Codes blog — Remastered Image Upload v23.2 | Social | 2023 | https://blog.united-codes.com/post/rich-text-editor-pro-v232-remastered-image-upload |
| 23 | MacArthur — Notion presigned image proxy | Social | 2023 | https://macarthur.me/posts/serving-notion-presigned-images-with-cloudflare/ |
| 24 | Slava Vishnyakov Tiptap upload gist | Social | 2021 | https://gist.github.com/slava-vishnyakov/16076dff1a77ddaca93c4bccd4ec4521 |
| 25 | Supabase discussion #13741 (cron + grace-period) | Social | 2023 | https://github.com/orgs/supabase/discussions/13741 |
| 26 | Liveblocks Tiptap best practices | Social | 2024 | https://liveblocks.io/docs/guides/tiptap-best-practices-and-tips |
| 27 | Shapiro et al. 2011 — CRDT comprehensive study | Paper (peer-reviewed) | 2011 | INRIA RR-7506 / SSS 2011 |
| 28 | Litt, Lim, Kleppmann, van Hardenberg 2022 — Peritext | Paper (peer-reviewed) | 2022 | CSCW 2022 |
| 29 | Gentle & Kleppmann 2025 — Eg-walker | Paper (peer-reviewed) | 2025 | EuroSys 2025 |
| 30 | Noor et al. 2023 — RemOrphan | Paper (peer-reviewed) | 2023 | IEEE Access |
| 31 | Maheshwari & Liskov 1997 — Partitioned distributed GC | Paper (peer-reviewed) | 1997 | SIGMOD '97 |
| 32 | Yorkie GC design doc | Engineering doc (not peer-reviewed) | 2023 | Internal/public design doc |
| 33 | convex-helpers README | Official | Current | https://github.com/get-convex/convex-helpers/blob/main/packages/convex-helpers/README.md |

### Out of scope but interesting

- **Signed-URL proxy pattern** (MacArthur / Cloudflare R2): Proxying Convex storage URLs through a stable CDN URL to prevent signed-URL expiry breakage. Relevant if Mirror ever exposes article bodies to search crawlers or embeds images in email. Out of scope for this research but a logical follow-on to the storageId-in-node approach.
- **CRDT collaborative editing and blob tombstone GC** (Shapiro 2011, Yorkie design doc): Causal stability for tombstone purge is the formally correct condition in a collaborative setting. Mirror does not currently use collaborative editing. Relevant only if real-time multi-user editing is added later.
- **GDPR cascade delete through doc→blob graph**: No academic or official treatment specific to Convex. The content-diff body walk already needed for orphan cleanup is the natural insertion point for GDPR delete, but formal treatment is out of scope here.

### Open questions

- **Is `body` intentionally external-URL-only?** Unsplash mock data in existing articles suggests inline images may have been external-URL-only by design. This decision must be made before implementing `storageId` in nodes. The `feature-add-editor` branch name implies write-mode is in scope, but the question of inline image upload specifically is unconfirmed. Decision owner: user.
- **`inlineImageStorageIds` denormalized field vs. body-walk at delete time**: Storing a flat `v.array(v.id("_storage"))` on the article record enables O(1) cascade delete without walking the body. Body-walk is simpler schema but O(n) per article per delete. For article counts in a personal blogging tool, body-walk is acceptable; for multi-tenant scale, the denormalized field wins. Decision owner: user / create-spec.
- **Posts vs. articles parity**: Both surfaces have identical cover-image lifecycle. Should inline images be implemented identically for both, or is one surface out of scope for this feature? The gap analysis above treats them in parallel (consistent with the existing pattern), but scope confirmation is needed before implementation.
