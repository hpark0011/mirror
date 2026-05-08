---
id: FG_180
title: "articles.update silently drops a new poster id when video id is unchanged"
date: 2026-05-08
type: fix
status: to-do
priority: p2
description: "Branch 2 of the cover-patch logic only fires when args.coverVideoStorageId differs from the stored value. A caller that sends the same video id with a new poster id falls through to the no-op branch — the new poster blob is uploaded, claimed, billed in storage, but never persisted to the article row."
dependencies: []
parent_plan_id: PLAN_010
acceptance_criteria:
  - "`grep -nA 3 'else if' packages/convex/convex/articles/mutations.ts` shows a branch that fires when video id matches stored AND poster id differs, writing the new poster and deleting the old one"
  - "A convex-test case sends an update with same videoStorageId and a new posterStorageId, asserts row.coverVideoPosterStorageId is the new id and the old poster blob is deleted"
  - "`pnpm --filter=@feel-good/convex test` passes"
  - "`pnpm --filter=@feel-good/mirror lint` exits 0"
owner_agent: "Convex Backend Engineer"
---

# articles.update Silently Drops a New Poster Id When Video Id Is Unchanged

## Context

The `update` mutation's cover-patch logic in `packages/convex/convex/articles/mutations.ts:422-456` is a five-branch `if/else if` chain:

1. Branch 1: `clearCoverImage: true` — wipe everything
2. Branch 2: video changed — replace video + poster, clear image
3. Branch 3: image changed — replace image, clear video
4. Branch 4: image-thumbhash-only — patch hash
5. Branch 5: round-trip no-op — no patch

Branch 2's entry condition is `args.coverVideoStorageId !== undefined && args.coverVideoStorageId !== article.coverVideoStorageId`. When the caller sends the **same** video id and a **new** poster id, neither the mutual-exclusion guard at lines 315-329 throws (both are defined together) nor does Branch 2 fire (video unchanged) — the call falls through to Branch 4 or 5. The new `posterStorageId` is silently dropped.

Failure mode: the caller has uploaded a new poster blob, called `claimCoverVideoPosterOwnership` (which committed an ownership row), but the article row continues to reference the OLD poster. The new poster blob lives in `_storage` with no article reference and gets reclaimed by the cron sweep eventually. Mid-term: the article serves the stale poster forever (until video is fully replaced).

This is unreachable from the current UI (both upload hooks always produce a new video+poster pair atomically), but the mutation API surface is exposed and the silent drop is a footgun.

- **Source:** Code review of PLAN_010 article-cover-video branch
- **Location:** `packages/convex/convex/articles/mutations.ts:433-456`
- **Evidence:** Branch 2's condition only checks video id; no fallthrough branch handles poster-only updates.

## Goal

A caller that sends the same video id with a new poster id sees the new poster persisted to the article row and the old poster blob deleted.

## Scope

- Add a sub-condition (or a new Branch 2b) that fires when video id matches stored AND poster id differs.
- Add a convex-test case proving the new path works.

## Out of Scope

- Refactoring the entire branch chain into a "decide-then-apply" function (FG_184 covers maintainability separately).
- Changing the upload hook to support poster-only updates from the UI.

## Approach

Extend Branch 2's condition to fire when EITHER the video OR the poster differs:

```ts
} else if (
  args.coverVideoStorageId !== undefined &&
  (args.coverVideoStorageId !== article.coverVideoStorageId ||
    (args.coverVideoPosterStorageId !== undefined &&
     args.coverVideoPosterStorageId !== article.coverVideoPosterStorageId))
) {
  patch.coverVideoStorageId = args.coverVideoStorageId;
  patch.coverVideoPosterStorageId = args.coverVideoPosterStorageId;
  // … same as today
  replacedVideo = args.coverVideoStorageId !== article.coverVideoStorageId;
  replacedPoster =
    args.coverVideoPosterStorageId !== article.coverVideoPosterStorageId;
}
```

The downstream cascade-delete logic already handles `replacedVideo=false, replacedPoster=true` correctly (the third delete block fires for poster-only changes).

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. In `packages/convex/convex/articles/mutations.ts`, extend Branch 2's condition to OR in the poster-id-changed case.
2. Make `replacedVideo` reflect only the video-id change (not poster).
3. Confirm the cascade-delete blocks at lines 481-499 still produce the correct result (existing tests cover this).
4. Add a convex-test case in the PLAN_010 describe block: create with video+poster, update with same videoStorageId + new posterStorageId, assert row's poster id changed and old poster blob is deleted.
5. Run `pnpm --filter=@feel-good/convex test`.

## Constraints

- The mutual-exclusion guard at lines 315-329 must remain — caller cannot send both image and video.
- Branch 5 (round-trip no-op) must still fire when both video AND poster are unchanged.
- No client-code change required — this is a defensive server fix.

## Resources

- Source: `packages/convex/convex/articles/mutations.ts:433-456,481-499`
- Existing test: `mutations.test.ts:761-801` (video-replace test — pin a parallel poster-only-replace alongside)
