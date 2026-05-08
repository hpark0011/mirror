---
id: FG_178
title: "Cover-video e2e fixture must be committed so happy-path tests run in CI"
date: 2026-05-08
type: fix
status: to-do
priority: p1
description: "The MP4 fixture path resolved in apps/mirror/e2e/article-cover-video.authenticated.spec.ts is untracked. Both upload tests test.skip silently when missing — CI green is meaningless. Tier-5 verification of the upload pipeline, MIME guard, and render precedence is lost."
dependencies: []
parent_plan_id: PLAN_010
acceptance_criteria:
  - "`git ls-files apps/mirror/e2e/fixtures/cover-video.mp4` returns the path (file is committed)"
  - "The fixture file is < 500 KB to keep the repo lean"
  - "The e2e spec resolves the fixture from apps/mirror/e2e/fixtures/ rather than workspace/artifacts/ — `grep -n 'cover-video.mp4\\|workspace/artifacts' apps/mirror/e2e/article-cover-video.authenticated.spec.ts` shows the new path and no `workspace/artifacts` reference"
  - "`pnpm --filter=@feel-good/mirror test:e2e -- article-cover-video` runs all three upload tests (no `test.skip` fires)"
owner_agent: "QA Test Engineer"
---

# Cover-Video E2E Fixture Must Be Committed So Happy-Path Tests Run in CI

## Context

The e2e spec `apps/mirror/e2e/article-cover-video.authenticated.spec.ts:21-24` resolves a fixture at `workspace/artifacts/software with less input.mp4`:

```ts
const COVER_VIDEO_FIXTURE = path.resolve(
  __dirname,
  "../../../workspace/artifacts/software with less input.mp4",
);
```

`git ls-files --others --exclude-standard` confirms this file is untracked (not committed, not gitignored). Lines 72-75 and 145-148 use `test.skip(!fs.existsSync(COVER_VIDEO_FIXTURE), ...)` — when the fixture is missing, both upload tests silently skip and the suite reports green.

In any CI environment that clones the repo, all three tests that exercise the actual upload flow (happy path, /new flow, network response assertions for CSP `media-src` regression detection) will silently skip. Invariants #7 (MIME + size guard), #9 (render precedence), and #10 (CSP `media-src` allows Convex hosts) lose their CI-enforced regression protection.

- **Source:** Code review of PLAN_010 article-cover-video branch
- **Location:** `apps/mirror/e2e/article-cover-video.authenticated.spec.ts:21-24,72-75,145-148`
- **Evidence:** `git ls-files --others` returns the path; both upload tests `test.skip` on missing fixture.

## Goal

A small MP4 fixture is committed at a stable path under `apps/mirror/e2e/fixtures/`. All three cover-video upload tests run in CI without `test.skip`, providing real Tier-5 regression coverage.

## Scope

- Generate or download a small (< 500 KB) H.264-in-MP4 fixture suitable for the upload pipeline.
- Commit the fixture at `apps/mirror/e2e/fixtures/cover-video.mp4`.
- Update the spec to resolve from the new path.

## Out of Scope

- Adding fixtures for the MIME-reject and size-reject paths (FG_175 generates those in-memory).
- Migrating other untracked workspace/artifacts/* references (separate audit).
- Reducing the existing 24-MiB fixture's size — replace with a fresh small one.

## Approach

Use `ffmpeg` (or check for an existing tiny MP4 in the repo) to generate a minimal valid H.264-in-MP4 file. Target: a few KB to ~100 KB, just enough to produce a valid `loadedmetadata` event and one decodable frame for `extractPosterBlob`.

```bash
ffmpeg -f lavfi -i color=c=black:s=320x240:d=1 \
  -c:v libx264 -pix_fmt yuv420p -t 1 \
  -movflags +faststart \
  apps/mirror/e2e/fixtures/cover-video.mp4
```

This produces a ~5 KB, 1-second 320×240 H.264 MP4 — valid container, valid metadata, decodes one frame.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Run the ffmpeg command above (or equivalent) to produce a minimal MP4 at `apps/mirror/e2e/fixtures/cover-video.mp4`.
2. Verify the file plays in a browser (preview locally) and that `extractPosterBlob` succeeds against it.
3. Update `apps/mirror/e2e/article-cover-video.authenticated.spec.ts:21-24` to resolve from `apps/mirror/e2e/fixtures/cover-video.mp4`.
4. Remove the `test.skip(!fs.existsSync(...))` guards from both upload tests — the fixture is now always present.
5. Run `pnpm --filter=@feel-good/mirror test:e2e -- article-cover-video` and confirm all three tests run (no skip messages in the output).
6. `git add apps/mirror/e2e/fixtures/cover-video.mp4` and commit.

## Constraints

- Fixture file must be < 500 KB to keep the repo lean.
- Fixture must be a valid H.264-in-MP4 — `claimCoverVideoOwnership` validates `contentType === "video/mp4"` server-side, so the file must produce that content type when uploaded.
- Don't gitignore the fixture — it's intentionally tracked.

## Resources

- Existing untracked file: `workspace/artifacts/software with less input.mp4` (24 MiB, too large to commit)
- ffmpeg docs: https://ffmpeg.org/documentation.html
- Verification rule: `.claude/rules/verification.md` (Tier 5 = e2e must run, not skip)
