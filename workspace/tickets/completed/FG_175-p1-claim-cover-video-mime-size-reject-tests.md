---
id: FG_175
title: "claimCoverVideoOwnership MIME and size reject paths need failing-regression tests"
date: 2026-05-08
type: fix
status: completed
priority: p1
description: "The MIME-reject and size-cap-reject branches in claimCoverVideoOwnership have no failing test today. The unit suite documents convex-test cannot preserve contentType, and the e2e only covers the valid MP4 happy path. A regression that removes the MIME guard or size cap would pass CI green."
dependencies: ["FG_178"]
parent_plan_id: PLAN_010
acceptance_criteria:
  - "A new e2e test in `apps/mirror/e2e/article-cover-video.authenticated.spec.ts` POSTs a non-MP4 file directly to a Convex generateUploadUrl, calls claimCoverVideoOwnership, asserts the call rejects with a MIME-error message"
  - "A second new e2e test exercises the size-cap reject by uploading a file > 25 MiB and asserting claimCoverVideoOwnership rejects with a size-error message"
  - "Both tests assert the offending blob is deleted afterward (`ctx.db.system.get` returns null) — proves the safeDeleteStorage cleanup branch fires"
  - "`pnpm --filter=@feel-good/mirror test:e2e -- article-cover-video` passes"
owner_agent: "QA Test Engineer"
---

# claimCoverVideoOwnership MIME and Size Reject Paths Need Failing-Regression Tests

## Context

The unit test block in `packages/convex/convex/articles/__tests__/mutations.test.ts:564-590` explicitly documents:

> "convex-test 0.0.51's `ctx.storage.store(blob)` does NOT preserve the Blob's `type` — `_storage` metadata reads back with `contentType: undefined` regardless of what we set on the Blob. That makes the MIME check inside `claimCoverVideoOwnership` untestable here."

The test file circumvents this by inserting ownership rows directly via `t.run` for the create/update flow tests. The MIME and size guards (`packages/convex/convex/articles/mutations.ts:717-729`) are never actually exercised by any failing test.

The e2e spec `apps/mirror/e2e/article-cover-video.authenticated.spec.ts` only tests a valid 24 MiB MP4 happy path. There is no test that:
- Uploads `image/png` and claims it as a video — should reject with MIME error
- Uploads a 30 MiB MP4 — should reject with size-cap error
- Verifies the offending blob is deleted afterward

A regression that inverts or removes the MIME check at line 717 would pass the entire test suite. Same for the size cap at line 724.

- **Source:** Code review of PLAN_010 article-cover-video branch
- **Location:** `packages/convex/convex/articles/mutations.ts:717-729` + `apps/mirror/e2e/article-cover-video.authenticated.spec.ts`
- **Evidence:** No failing assertion exists for either reject branch.

## Goal

The MIME and size guards in `claimCoverVideoOwnership` have failing-regression tests that fail loudly if the guards are removed or inverted.

## Scope

- Add an e2e test that exercises the MIME reject path against a real Convex deployment.
- Add an e2e test that exercises the size-cap reject path.
- Both tests must verify the rejected blob is deleted (proves the cleanup branch).

## Out of Scope

- Adding analogous tests for `claimCoverImageOwnership` (FG_182 will add MIME validation there first).
- Replacing `convex-test` with a fork that preserves `contentType`.
- The fixture-commit issue (FG_178).

## Approach

The e2e harness already has a Convex client and a Playwright authenticated context. Add two new tests after the happy-path test:

1. **MIME reject:** generate a small PNG buffer (a few hundred bytes), call `generateArticleCoverVideoUploadUrl` directly via the Convex client, PUT the buffer at the returned URL, then call `claimCoverVideoOwnership` with the resulting storage id. Assert it rejects with a message matching `/cover video must be one of/`. Then call a test helper that reads `_storage` metadata for that id and assert it returns null.

2. **Size reject:** generate a 26 MiB ArrayBuffer of random bytes (still small enough to not break test runtime), claim it as `video/mp4`, assert it rejects with `/exceeds maximum size/`. Confirm blob deletion.

This requires either using the dev-deployment URL (per-worktree) or the Playwright `authenticatedPage` helper to drive the calls via the in-page Convex client.

- **Effort:** Medium
- **Risk:** Low (test-only)

## Implementation Steps

1. Inspect the existing e2e helpers in `apps/mirror/e2e/fixtures/` to see how they call Convex mutations (probably via `page.evaluate(() => convex.mutation(...))` or similar).
2. Add the two test cases described above to `apps/mirror/e2e/article-cover-video.authenticated.spec.ts`.
3. Add a test helper that fetches `_storage` metadata for a given id (may require a new `/test/storage-meta` HTTP endpoint gated on `PLAYWRIGHT_TEST_SECRET` per `.claude/rules/auth.md`).
4. Run `pnpm --filter=@feel-good/mirror test:e2e -- article-cover-video`.
5. Confirm green; commit.

## Constraints

- Tests must run against a real Convex deployment (the convex-test framework cannot exercise these paths).
- Any new test-only HTTP endpoint must be gated on `PLAYWRIGHT_TEST_SECRET`.
- Test runtime should stay under the existing 90s budget — generate the 26 MiB buffer in-memory rather than reading from disk.

## Resources

- Source: `packages/convex/convex/articles/mutations.ts:704-744`
- Existing e2e: `apps/mirror/e2e/article-cover-video.authenticated.spec.ts`
- `.claude/rules/auth.md` — test secret gating pattern
