---
id: PLAN_010
slug: article-cover-video
title: "Allow MP4 video as an article cover (in addition to image)"
date: 2026-05-08
type: feature
status: draft
branch: feature-article-cover-video
worktree: .worktrees/feature-article-cover-video/
scope: "Authors can upload an MP4 cover for an article. List card and detail view render <video autoPlay loop muted playsInline> with a poster frame; image cover path is unchanged."
apps: [mirror]
verification_tier: 5
predecessor: PLAN_001
---
## Problem

Article covers are image-only today. The render path uses `next/image`, the picker hardcodes `accept="image/png,image/jpeg,image/webp"`, and the storage policy in `packages/convex/convex/content/storagePolicy.ts` deliberately bundles cover-image limits with inline-image limits (5 MiB, three image MIME types). Authors cannot use a short looping clip as a cover — a common motion-design pattern that already exists for the Rick Rubin profile fixture (`apps/mirror/features/profile/components/profile-media.tsx`, hardcoded `/portrait-video.mp4`).

This plan adds an opt-in MP4 path that coexists with the image path. Image is still the default and the rule for covers stays decorative — no embedding work.

## Goal

When an author picks an MP4 cover in the article editor:

1. The file uploads to Convex storage and a still poster is captured client-side and uploaded as a sibling image.
2. The article persists `coverVideoStorageId` and `coverVideoPosterStorageId`.
3. The article list card and detail view render `<video autoPlay loop muted playsInline poster={posterUrl} src={videoUrl}>` instead of `next/image`.
4. Replacing or removing a video cover cleans up both blobs and the ownership row, exactly mirroring the image flow.

## Non-goals

- **No clone-agent / embeddings change.** Covers are decorative per `.claude/rules/embeddings.md` (FG_150 Option B). `getContentForEmbedding` and `embeddingSourceTableValidator` stay untouched.
- **No video format beyond** `video/mp4` **(H.264).** WebM, HEVC, MOV are out of scope. Adding them is a follow-up gated on real demand.
- **No server-side transcoding, trimming, or muxing.** The user uploads what they have; the client validates MIME + size.
- **No post-cover-video parity.** Posts ship video covers in a follow-up plan (same shape, separate diff). This plan is articles-only to keep the surface tight.
- **No profile / avatar video.** Tracked separately.
- **No audio.** `<video muted>` is enforced — autoplay browsers require it and the design treats covers as silent loops.
- **No thumbhash for the video poster.** The poster is already a still image but the LQIP backfill (`scripts/backfill-cover-thumbhash.ts`) and `coverImageThumbhash` field are scoped to the image cover. Skippable by design — the poster swap is fast enough that the LQIP gain is marginal. Revisit if perceived lag shows up in QA.

## Architectural decisions

### D1. Data shape — sibling fields, not a union — **LOCKED 2026-05-08**

Add `coverVideoStorageId` and `coverVideoPosterStorageId` as new optional fields on `articles`. Keep `coverImageStorageId` and `coverImageThumbhash` exactly as they are.

**Why not a discriminated union (**`coverMedia: { kind: "image" | "video", … }`**)?**

- A union forces a backfill migration on every existing row (per `convex-migration-helper`'s widen-migrate-narrow). Sibling optionals are non-breaking and need no migration.
- The orphan-sweep registry (`packages/convex/convex/content/storageRegistry.ts`) is keyed on `<table>.<field>`. Two separate scalar fields are two registry entries — straightforward. A union pushes the storage-id out of the field name and into a nested accessor.
- Render precedence is a one-line rule: **video wins if** `coverVideoStorageId` **is set**, otherwise fall back to image. Easy to reason about, easy to e2e.

Trade-off: a row could in principle have both fields set if a write path forgets to clear the other. The `update` mutation enforces "set one → clear the other" explicitly, and the schema regression test asserts both fields participate in the orphan registry, so the sweep cleans up either way.

### D2. Poster — client-extracted from the chosen MP4 — **LOCKED 2026-05-08**

Use a hidden `<video>` element + `<canvas>.drawImage` to grab a frame at `currentTime = 0.1s`, encode as `image/jpeg` blob, upload it as a separate `_storage` blob, and store its id as `coverVideoPosterStorageId`. The poster MUST be uploaded BEFORE the article row is written so the rendered `<video poster={posterUrl}>` has something to show before metadata loads.

Alternatives considered:

- **No poster.** `<video preload="metadata">` shows a black frame until the first frame decodes, which on slow networks is a visible flash. Rejected.
- **Server-side ffmpeg.** Too much infra for the win. Rejected.
- **User-uploaded poster.** Extra UX step authors will skip. Rejected unless the auto-extraction proves unreliable in QA.

### D3. Size cap — 25 MiB — **LOCKED 2026-05-08**

5 MiB is far too small for usable video; 50 MiB is generous enough to invite abuse. 25 MiB ≈ \~10–15 s of 720p H.264 at a sane bitrate, which matches the looping-clip use case.

The cap lives next to the existing `MAX_INLINE_IMAGE_BYTES` in `storagePolicy.ts` as a separate constant `MAX_COVER_VIDEO_BYTES`. Server-side enforcement: there is no Convex hook to reject by Content-Length on the upload URL itself, so the post-upload `claimCoverVideoOwnership` mutation reads `_storage` metadata (`ctx.db.system.get`) and rejects if `size > MAX_COVER_VIDEO_BYTES`, deleting the over-cap blob. This is the same defense-in-depth shape `inlineImageOwnership` already uses — keep it consistent.

### D4. CSP `media-src` must include Convex storage

Today's CSP is:

```
media-src 'self' https://*.daily.co blob:
```

`<video src={https://<deployment>.convex.cloud/api/storage/...}>` requires the host to be allowed by `media-src`, NOT `img-src`. Add `https://*.convex.cloud` (and `https://*.convex.site` for symmetry with `img-src`) to `media-src` in `apps/mirror/next.config.ts`. **Without this, the video silently fails to load on production with a console-only CSP error — a footgun loud enough to stop the demo.**

## Current state — files to touch

| Concern | File | Today | After |
| --- | --- | --- | --- |
| Storage policy constants | `packages/convex/convex/content/storagePolicy.ts` | Image-only | Adds `ALLOWED_COVER_VIDEO_TYPES`, `MAX_COVER_VIDEO_BYTES` |
| Client-safe re-export | `apps/mirror/lib/media-policy.ts` | Image-only | Re-exports the new video constants + `ALLOWED_COVER_VIDEO_TYPES_ATTR` |
| Article schema | `packages/convex/convex/articles/schema.ts` | `coverImageStorageId`, `coverImageThumbhash` | Adds `coverVideoStorageId`, `coverVideoPosterStorageId` |
| Storage field registry | `packages/convex/convex/content/storageRegistry.ts` | Lists `articles.coverImageStorageId`, `posts.coverImageStorageId`, `users.avatarStorageId`, inline-body for both | Adds `articles.coverVideoStorageId` and `articles.coverVideoPosterStorageId` |
| Article mutations | `packages/convex/convex/articles/mutations.ts` | `create`/`update`/`remove`/`generateArticleCoverImageUploadUrl`/`claimCoverImageOwnership`/`deleteOrphanCoverImage` accept image only | Adds matching `…CoverVideo…` mutations + extends `create`/`update`/`remove` to handle the new fields and clean up sibling blobs |
| Cover ownership table | `packages/convex/convex/articles/schema.ts` | `coverImageOwnership` indexed on storageId + userId+createdAt | Single `coverImageOwnership` table is reused; ownership-row `storageId` is the video blob OR the poster blob (each gets its own row). The table name stays as-is to avoid a migration; the doc comment is updated to read "cover-blob ownership". |
| Article queries | `packages/convex/convex/articles/queries.ts` | Returns `coverImageUrl`, `coverImageThumbhash` | Adds `coverVideoUrl`, `coverVideoPosterUrl` (both \`string |
| Article list card | `apps/mirror/features/articles/components/list/article-list-featured-card.tsx` | `next/image` | Branches on `coverVideoUrl ?? coverImageUrl`; renders `<video>` when video, else `next/image` |
| Article detail | `apps/mirror/features/articles/components/detail/article-detail.tsx` | `next/image` | Same branch; mirrors the `<video autoPlay loop muted playsInline>` pattern from `apps/mirror/features/profile/components/profile-media.tsx` |
| Cover picker (editor) | `apps/mirror/features/articles/components/editor/cover-image-picker.tsx` | `accept="image/png,image/jpeg,image/webp"` + `<img>` preview | Accept also adds `video/mp4`; preview branches to `<video>` when the picked file is video |
| Upload hook | `apps/mirror/features/articles/hooks/use-article-cover-image-upload.ts` | Uploads image + computes thumbhash | New sibling hook `use-article-cover-video-upload.ts` extracts poster, uploads both blobs, claims both ownership rows; the picker picks which hook based on `file.type` |
| Form submission | `apps/mirror/features/articles/hooks/use-new-article-form.tsx` & `use-edit-article-form.ts` | Persists `coverImageStorageId` + thumbhash | Persists either image fields or video fields; the "remove" path clears both |
| Test fixture | `packages/convex/convex/auth/testHelpers.ts` `ensureTestArticleFixtures` | Resets `coverImageStorageId: undefined` | Also resets `coverVideoStorageId` + `coverVideoPosterStorageId`. Add an opt-in branch keyed off `args.key === "with-cover-video"` that seeds a tiny pre-uploaded MP4 + JPEG poster for the e2e (mirror existing fixture-seeding patterns). |
| HTTP fixture endpoint | `packages/convex/convex/http.ts` `/test/ensure-article-fixtures` | Calls the helper | No signature change needed — `args.key` already plumbed through |
| Next.js config | `apps/mirror/next.config.ts` | `media-src 'self' https://*.daily.co blob:` | `media-src` adds `https://*.convex.cloud https://*.convex.site` |
| Article types | `apps/mirror/features/articles/types.ts` | `coverImageUrl`, `coverImageThumbhash` | Adds \`coverVideoUrl: string |
| Article mutations test | `packages/convex/convex/articles/__tests__/mutations.test.ts` | Asserts cover-image flows | New cases for video flows + image↔video swap |
| Orphan sweep test | `packages/convex/convex/content/__tests__/orphanSweep.test.ts` | Asserts schema/registry set-equality + grace window | Asserts the two new registry entries appear; adds an end-to-end "video cover replaced → both old video and old poster blobs swept" case |
| New e2e | `apps/mirror/e2e/article-cover-video.authenticated.spec.ts` | — | The hard-verification spec (see below) |

## Implementation steps

### Phase 1 — Policy + schema (no UI yet)

1. **Extend** `storagePolicy.ts` with `ALLOWED_COVER_VIDEO_TYPES = new Set(["video/mp4"])` and `MAX_COVER_VIDEO_BYTES = 25 * 1024 * 1024`. Keep both adjacent to the existing image constants with a comment that says "video-cover policy — separate cap from image".
2. **Re-export from** `apps/mirror/lib/media-policy.ts` the two new constants plus a derived `ALLOWED_COVER_VIDEO_TYPES_ATTR` (comma-joined string for `<input accept>`).
3. **Add the two new optional fields** to `articleFields` in `packages/convex/convex/articles/schema.ts`. No migration needed (Convex tolerates new optional fields on existing rows).
4. **Append two** `kind: "scalar"` **entries** to `STORAGE_FIELD_REFERENCES` in `packages/convex/convex/content/storageRegistry.ts` for `articles.coverVideoStorageId` and `articles.coverVideoPosterStorageId`.
5. **Run the schema-introspection test in** `orphanSweep.test.ts`**.** It asserts set-equality between schema's `v.id("_storage")` fields and the registry; it MUST pass before moving on. If it fails, the registry update is incomplete.

### Phase 2 — Mutations

 6. **Add** `generateArticleCoverVideoUploadUrl` **and** `generateArticleCoverVideoPosterUploadUrl` in `articles/mutations.ts`. Both are thin wrappers over `ctx.storage.generateUploadUrl()` like the existing image one. Keep them as separate mutations (vs. one mutation returning two URLs) so the client can issue them in parallel and so the orphan-cleanup paths stay symmetric.
 7. **Add** `claimCoverVideoOwnership` **and** `claimCoverVideoPosterOwnership` that insert into the `coverImageOwnership` table (renamed in comment only) and additionally validate `_storage` metadata size against the cap — reject + delete the blob if oversize.
 8. **Extend** `articles.create` **and** `articles.update` **validators** with `coverVideoStorageId: v.optional(v.id("_storage"))` and `coverVideoPosterStorageId: v.optional(v.id("_storage"))`. Mirror the four-branch update logic that exists for the image cover (no-op / clear / new / unchanged) and add a fifth invariant: "video and image are mutually exclusive — setting one clears the other on the row, but the storage cleanup of the *replaced* fields uses the existing MAX_INLINE_DELETES_PER_INVOCATION bookkeeping".
 9. **Extend** `articles.remove` to delete both video + poster blobs alongside the image blob.
10. **Add** `deleteOrphanCoverVideo` that mirrors `deleteOrphanCoverImage` — full-table scan against `articles` for `coverVideoStorageId` AND `coverVideoPosterStorageId` references before delete. (Two scans because they are two separate fields.)

### Phase 3 — Queries + types

11. **Update** `getByUsername` **and** `getBySlug` in `articles/queries.ts` to resolve `coverVideoUrl` and `coverVideoPosterUrl` alongside the existing `coverImageUrl`. Reuse `resolveStorageUrl` (already used by `resolveArticleCoverImageUrl`).
12. **Update** `apps/mirror/features/articles/types.ts` `ArticleSummary` to add the two new fields.

### Phase 4 — UI

13. **Update** `cover-image-picker.tsx`:
    - Append `,video/mp4` to the `accept` attribute (use the new `ALLOWED_COVER_VIDEO_TYPES_ATTR` joined with the existing image attr — both single-sourced from `lib/media-policy.ts`).
    - In `handleSelect`, branch on `file.type.startsWith("video/")` to call the new video-upload hook (Phase 4 step 14) instead of the image-upload hook.
    - Replace the preview `<img>` with a discriminated `<img>` / `<video autoPlay loop muted playsInline>` based on the selected file.
    - Keep the existing `data-cover-upload-state` data attribute — the e2e relies on the same state machine.
14. **New hook** `use-article-cover-video-upload.ts`:
    - Accept a `File`, validate MIME + size client-side against the new policy constants.
    - Construct a hidden `<video>` element via `URL.createObjectURL`, seek to 0.1s, draw to canvas, export JPEG blob (quality 0.85) — this is the poster.
    - Get TWO upload URLs in parallel (`generateArticleCoverVideoUploadUrl` + `generateArticleCoverVideoPosterUploadUrl`).
    - Upload both blobs in parallel via `uploadToStorage`.
    - Claim ownership for both. If either claim fails, fire `deleteOrphanCoverVideo` to clean up the leak.
    - Resolve to `{ videoStorageId, posterStorageId }`.
15. **Update** `use-new-article-form.tsx` **and** `use-edit-article-form.ts` to plumb the video storage ids through `articles.create` / `articles.update`. The "remove cover" path clears both video fields AND the image fields — single button, single Convex call.
16. **Update** `article-detail.tsx` **and** `article-list-featured-card.tsx` to render `<video>` when `coverVideoUrl` is set (precedence: video &gt; image), else fall back to existing `next/image`. Mirror the attribute set from `profile-media.tsx`: `autoPlay loop muted playsInline preload="metadata"`. Add `data-testid="article-detail-cover-video"` (detail) and a sibling test id on the list card.
17. **Update** `apps/mirror/next.config.ts` CSP `media-src` to add `https://*.convex.cloud https://*.convex.site`.

### Phase 5 — Tests

18. **Unit:** extend `packages/convex/convex/articles/__tests__/mutations.test.ts` with cases for: create-with-video, update-image-to-video, update-video-to-image, update-video-replace, remove-with-video. Cover the size-cap reject in `claimCoverVideoOwnership`.
19. **Unit:** extend `packages/convex/convex/content/__tests__/orphanSweep.test.ts` with a "video cover replaced → both blobs swept after grace" case; the schema-introspection set-equality test runs naturally because both new fields are appended to the registry.
20. **E2E:** new spec `apps/mirror/e2e/article-cover-video.authenticated.spec.ts` (see Hard verification).

## Hard verification — Playwright CLI

Per `.claude/rules/verification.md` Tier 5 + the e2e tool-boundary rule (Playwright CLI only).

**File:** `apps/mirror/e2e/article-cover-video.authenticated.spec.ts`

**Setup:** call `/test/ensure-article-fixtures` with `key: "with-cover-video"` (new branch in `ensureTestArticleFixtures`) so the test starts with a known article + a tiny pre-seeded MP4 (a few-KB H.264-in-MP4 fixture in `apps/mirror/e2e/fixtures/tiny.mp4`) + JPEG poster ready to attach via `setInputFiles`.

**Test 1 — accept attribute and MIME reject:**

1. Navigate to the article editor (`/@test-user/articles/<slug>/edit`).
2. Assert `[data-testid="article-cover-image-picker"] input[type="file"]` has `accept` containing `video/mp4`.
3. `setInputFiles` with a `.txt` blob → assert an error / no preview.

**Test 2 — happy path upload + render:**

1. `setInputFiles(tiny.mp4)` on the picker.
2. Wait on `data-cover-upload-state="ready"` (existing deterministic hook — extends to the video flow).
3. Save the article.
4. Navigate to the article detail page.
5. Assert `[data-testid="article-detail-cover-video"]` is visible AND has `autoPlay`, `loop`, `muted`, `playsInline` attributes set.
6. Assert the rendered `<video>`'s `src` resolves over the network (Playwright `page.waitForResponse` with status 200 against the `*.convex.cloud/api/storage/...` URL) — this is what catches a missing `media-src` CSP entry.
7. Navigate to the list (`/@test-user/articles`). Assert the list card renders the same video element with the expected video URL.

**Test 3 — image → video swap cleans up the old image blob:**

1. From a fixture article that already has an image cover, replace with a video.
2. Save.
3. Read the new row state via the existing `/test/ensure-article-fixtures` resp (it returns the article doc) — assert `coverImageStorageId` is `undefined`, `coverVideoStorageId` is set, `coverVideoPosterStorageId` is set.
4. Hit `/test/run-orphan-sweep` (existing harness used by `orphanSweep.test.ts`-style flows; if not exposed via HTTP today, add a dedicated test endpoint mirroring `/test/ensure-article-fixtures`'s shape — keep it gated on `PLAYWRIGHT_TEST_SECRET` per `.claude/rules/auth.md`) with a fast-forwarded clock and assert the old image blob is deleted.

**Run command:**

```bash
pnpm --filter=@feel-good/mirror test:e2e -- article-cover-video
```

Plus the full Tier-5 chain:

```bash
pnpm build --filter=@feel-good/mirror
pnpm lint --filter=@feel-good/mirror
pnpm --filter=@feel-good/convex test
pnpm --filter=@feel-good/mirror test:unit
pnpm --filter=@feel-good/mirror test:e2e
```

All five must pass before flipping `status: completed`.

## Constraints & rules to honor

- **Single source of truth.** All new policy constants live in `packages/convex/convex/content/storagePolicy.ts`. The client imports via `apps/mirror/lib/media-policy.ts`. No parallel client constants.
- **Per-worktree Convex deployment** (`.claude/rules/worktrees.md`). Spin up `feature-article-cover-video` via `bash .claude/skills/new-worktree/scripts/new-worktree.sh feature-article-cover-video` BEFORE Phase 1 — the schema add is local-safe but every worktree needs its own dev deployment.
- **Cross-user isolation invariant** (`.claude/rules/embeddings.md`). The new mutations MUST derive `userId` from `getAppUser(ctx, ctx.user._id)`. Args validators MUST NOT include `userId`. Same as the existing image mutations — read the rule, then mirror exactly.
- **Identifier rule** (`.claude/rules/identifiers.md`) — does not apply (no new slug/handle), but the rule's spirit ("normalize at mutation boundary") translates to: validate MIME + size at the mutation boundary, never trust the client.
- **Optimistic updates** (`.claude/rules/optimistic-updates.md`). The list query already participates in optimistic updates for create/delete — adding video fields requires adding those fields to the optimistic shape (`(typeof current)[number]`-derived, not `Doc<>`-derived). Verify by running the existing article-list e2e under a slow network in Chrome MCP.
- **Deterministic e2e** (`.claude/rules/verification.md`). `data-cover-upload-state="ready"` is the synchronization mechanism. Never `page.waitForTimeout`.
- **CSP edit is non-trivial.** Once `media-src` ships, run a real preview deploy (one PR-build cycle on Vercel) before merging — CSP regressions don't surface in `pnpm dev` because Next dev mode doesn't apply the production CSP header.

## Open questions

1. **Sound on autoplay.** Browsers force `muted` for autoplay. The plan assumes silent loops — confirm with design that this matches intent before shipping. If sound is wanted, the picker grows a play-button overlay and we drop `autoPlay`.
2. **Animated GIFs.** GIF is technically `image/gif` but UX-equivalent to a silent loop. Out of scope here; revisit only if authors ask.
3. **Reduced-motion.** `prefers-reduced-motion` should pause the loop and show the poster only. Add a one-line CSS rule (`.cover-video { animation-play-state: paused; }`-equivalent — actually `<video>` needs JS) — note as a follow-up ticket if not done in Phase 4.

## Tickets to file after this plan lands

- FG_NNN — preferred-reduced-motion handling for video covers (Q3 above)
- FG_NNN — post cover video parity (mirrors this plan against `posts/`)
- FG_NNN — profile media upload UI (separate scope; see in-session investigation)