---
id: FG_173
title: "Poster extraction canvas must cap resolution to prevent mobile OOM and over-cap JPEG"
date: 2026-05-08
type: perf
status: completed
priority: p1
description: "extractPosterBlob allocates the canvas at full video resolution. A 4K MP4 (legal under the 25 MiB cap) creates a ~33 MB bitmap risking mobile OOM, and the resulting JPEG at quality 0.85 will exceed the 5 MiB poster cap, causing claimCoverVideoPosterOwnership to reject after the upload completes — silent for the user."
dependencies: []
parent_plan_id: PLAN_010
acceptance_criteria:
  - "`grep -n 'POSTER_MAX_DIMENSION\\|Math.min.*1920' apps/mirror/features/articles/hooks/use-article-cover-video-upload.ts` shows the resolution cap applied before drawImage"
  - "A vitest test passes a mocked video with videoWidth=3840, videoHeight=2160 and asserts canvas.width/height are clamped to 1920×1080 preserving aspect ratio"
  - "`pnpm --filter=@feel-good/mirror test:unit -- use-article-cover-video-upload` passes"
  - "`pnpm --filter=@feel-good/mirror lint` exits 0"
owner_agent: "React Performance Engineer"
---

# Poster Extraction Canvas Must Cap Resolution to Prevent Mobile OOM and Over-Cap JPEG

## Context

`extractPosterBlob` (`apps/mirror/features/articles/hooks/use-article-cover-video-upload.ts:118-125`) sets canvas dimensions from `video.videoWidth || 1280` and `video.videoHeight || 720` — full source resolution with no cap. A 4K MP4 (3840×2160) — entirely legal under `MAX_COVER_VIDEO_BYTES = 25 * 1024 * 1024` — produces:

- **A ~33 MB in-memory bitmap** (3840 × 2160 × 4 bytes/pixel). On mobile devices with constrained GPU memory budgets this can trigger an OOM kill in Chrome for Android.
- **A JPEG larger than 5 MiB** at quality 0.85. The poster claim mutation `claimCoverVideoPosterOwnership` validates `meta.size > MAX_INLINE_IMAGE_BYTES` (5 MiB) and throws after the upload has completed. The user has waited for the upload, then sees an error with no recovery.

Both failures are silent: no progress indication, no size-precheck, no user-facing message that explains why their valid 4K video produced a "poster too large" failure.

- **Source:** Code review of PLAN_010 article-cover-video branch
- **Location:** `apps/mirror/features/articles/hooks/use-article-cover-video-upload.ts:118-125`
- **Evidence:** No max-dimension clamp; `MAX_COVER_VIDEO_BYTES = 25 * 1024 * 1024` allows 4K input.

## Goal

Poster JPEGs stay comfortably under the 5 MiB inline-image cap regardless of source video resolution. Mobile devices do not OOM on 4K covers. The poster preserves the source aspect ratio.

## Scope

- Cap the longer side of the canvas at 1920px before `drawImage`.
- Apply the scale factor to both dimensions to preserve aspect ratio.
- Add a vitest test for the resolution clamp.

## Out of Scope

- Changing the JPEG quality factor (0.85 is fine post-clamp).
- Showing upload progress (FG_192).
- Server-side poster generation (rejected in plan D2).

## Approach

```ts
const POSTER_MAX_DIMENSION = 1920;
const sourceWidth = video.videoWidth || 1280;
const sourceHeight = video.videoHeight || 720;
const scale = Math.min(
  1,
  POSTER_MAX_DIMENSION / Math.max(sourceWidth, sourceHeight),
);
canvas.width = Math.round(sourceWidth * scale);
canvas.height = Math.round(sourceHeight * scale);
const ctx = canvas.getContext("2d");
…
ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
```

A 1920×1080 JPEG at quality 0.85 typically encodes to 200-500 KB — comfortably under the 5 MiB cap with headroom.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. In `apps/mirror/features/articles/hooks/use-article-cover-video-upload.ts`, define `const POSTER_MAX_DIMENSION = 1920;` near the existing constants.
2. Replace the canvas dimension assignment (lines 119-120) with the clamped version above.
3. Add a vitest test using a mocked HTMLVideoElement with `videoWidth=3840, videoHeight=2160`, assert canvas dimensions are clamped (1920×1080).
4. Add a second test with `videoWidth=720, videoHeight=1280` (portrait), assert no upscaling (canvas stays 720×1280).
5. Run `pnpm --filter=@feel-good/mirror test:unit -- use-article-cover-video-upload`.
6. Run `pnpm --filter=@feel-good/mirror lint && pnpm --filter=@feel-good/mirror build`.

## Constraints

- Aspect ratio MUST be preserved — non-square clamping would distort the poster.
- The 1920px cap is arbitrary — document the reasoning (1920×1080 ≈ 200-500 KB JPEG, well under 5 MiB) so it can be raised if QA finds visible quality loss.

## Resources

- Source: `apps/mirror/features/articles/hooks/use-article-cover-video-upload.ts:70-141`
- `packages/convex/convex/content/storagePolicy.ts:25` — `MAX_INLINE_IMAGE_BYTES`
