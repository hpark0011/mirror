---
id: FG_198
title: "Document articles.remove non-transactional storage-delete window with cron-sweep safety net"
date: 2026-05-08
type: docs
status: completed
priority: p3
description: "articles.remove deletes the row before storage blobs (intentional ordering — cron sweep is the safety net). Brief window where a cached signed URL still serves the video after the row is gone. Pre-existing pattern for images; PLAN_010 extends to video+poster. Add an inline comment block documenting the invariant."
dependencies: []
parent_plan_id: PLAN_010
acceptance_criteria:
  - "A multi-line comment block above the cascade-delete in articles.remove (lines ~580-594) documents: (1) row deletion happens before storage deletion intentionally, (2) the brief signed-URL access window is accepted by design, (3) the cron sweep is the safety net for failed storage deletes, (4) ORPHAN_GRACE_MS is 24h"
  - "No code change; comment-only ticket"
  - "`pnpm --filter=@feel-good/convex test` continues to pass (no behavior change)"
owner_agent: "Convex Backend Engineer"
---

# Document articles.remove Non-Transactional Storage-Delete Window With Cron-Sweep Safety Net

## Context

`articles.remove` (`packages/convex/convex/articles/mutations.ts:563-630`) deletes the article row before storage blobs:

```ts
await ctx.db.delete(article._id);

// Delete covers after the row is gone so a failed delete can't leave a
// live article pointing at a missing asset. Best-effort: a missing or
// transient blob must not abort the whole removal — the cron sweep
// collects any survivors. PLAN_010: an article carries at most one
// cover kind at any time, but legacy rows or write races could in
// principle have both — clean up whichever fields are populated.
await safeDeleteStorage(ctx, article.coverImageStorageId);
await safeDeleteStorage(ctx, article.coverVideoStorageId);
await safeDeleteStorage(ctx, article.coverVideoPosterStorageId);
```

This ordering is correct for the article-row invariant ("never have a live row pointing at a missing asset"), but introduces a brief, intentional window where:

- Cached signed URLs still serve the now-gone video/image
- A concurrent `getBySlug` query returns null (the row is gone) but a CDN-cached URL works for seconds longer
- If `safeDeleteStorage` fails silently, the cron sweep eventually reclaims the bytes (24h grace + up to 24h until next sweep = 48h max)

This is a pre-existing pattern (image cover already had it). PLAN_010 extends to video and poster fields. The existing inline comment partially explains it but doesn't call out the cron-sweep invariant explicitly.

A future maintainer or auditor reading this file will reasonably ask "what if the storage delete fails?" The answer ("cron sweep") should be in the code, not in this ticket.

- **Source:** Code review of PLAN_010 article-cover-video branch
- **Location:** `packages/convex/convex/articles/mutations.ts:584-594`
- **Evidence:** Existing comment is partial; no explicit reference to the cron sweep schedule or grace window.

## Goal

The `articles.remove` cascade-delete carries an explicit comment that future readers can rely on for the "what if the delete fails?" question.

## Scope

- Add or expand the inline comment block above the storage deletes in `articles.remove`.
- Cite the cron-sweep schedule (`{ hours: 24 }` in `crons.ts`) and `ORPHAN_GRACE_MS` from `storagePolicy.ts`.
- Note that the same pattern is used in `articles.update` cascade-delete and the image-cover path.

## Out of Scope

- Refactoring the ordering (the current order is correct).
- Adding telemetry on `safeDeleteStorage` failures (FG_178 / future ops ticket).
- The pre-existing inline-image cleanup in `articles.update` and `articles.remove` (separate doc concern).

## Approach

```ts
// Cascade-delete cover blobs AFTER the row is deleted. This ordering is
// intentional and load-bearing: it ensures the row never points at a
// missing asset (a failed storage delete leaves an orphan, never a
// dangling reference).
//
// Trade-off: there is a brief window where a cached signed URL can still
// serve the deleted video. Convex signed-URL TTL plus any client-side
// caching = the maximum exposure (typically seconds).
//
// Failure mode: if safeDeleteStorage rejects (network drop, backend
// regression), it logs and returns — the orphan-sweep cron in
// crons.ts:152 reclaims the blob after ORPHAN_GRACE_MS (24h). Worst-case
// blob retention after a failed eager delete is ORPHAN_GRACE_MS + cron
// interval = up to 48h.
//
// Same pattern: articles.update cascade-delete (lines 481-499) and the
// pre-existing image-cover deletes.
await safeDeleteStorage(ctx, article.coverImageStorageId);
await safeDeleteStorage(ctx, article.coverVideoStorageId);
await safeDeleteStorage(ctx, article.coverVideoPosterStorageId);
```

- **Effort:** Small
- **Risk:** Low (comment only)

## Implementation Steps

1. In `mutations.ts`, expand the comment block at lines 586-591.
2. Confirm no behavior change — `pnpm --filter=@feel-good/convex test`.

## Constraints

- Comment must stay concise — max ~12 lines.
- This ticket is documentation-only — no rename of `coverImageOwnership`, no behavior change. Renaming the table to `coverBlobOwnership` is out of scope (not currently ticketed).

## Resources

- Source: `packages/convex/convex/articles/mutations.ts:563-630`
- Cron schedule: `packages/convex/convex/crons.ts:152`
- Constant: `packages/convex/convex/content/storagePolicy.ts:19` (`ORPHAN_GRACE_MS`)
