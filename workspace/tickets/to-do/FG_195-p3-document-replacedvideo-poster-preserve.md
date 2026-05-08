---
id: FG_195
title: "Document why poster blob is preserved when video is replaced with same poster id"
date: 2026-05-08
type: docs
status: to-do
priority: p3
description: "When Branch 2 fires with replacedVideo=true but replacedPoster=false (caller reuses the same poster id), the third cascade-delete block correctly preserves the old poster — it's the new poster too. The logic is correct but the omission of replacedVideo from the third condition is non-obvious. Add a clarifying inline comment."
dependencies: []
parent_plan_id: PLAN_010
acceptance_criteria:
  - "A comment block above lines 495-499 in articles/mutations.ts explains why the third delete condition uses (clearedAllCover || replacedImage || replacedPoster) and NOT replacedVideo"
  - "Comment cites the invariant: 'Reusing the same poster id across a video swap means the old poster IS the new poster — deletion would delete the live blob'"
  - "No code change; comment-only ticket"
owner_agent: "Convex Backend Engineer"
---

# Document Why Poster Blob Is Preserved When Video Is Replaced With Same Poster Id

## Context

In `articles.update` cascade-delete (`packages/convex/convex/articles/mutations.ts:481-499`), there are three independent `if` blocks. The third block:

```ts
if (clearedAllCover || replacedImage || replacedPoster) {
  if (article.coverVideoPosterStorageId) {
    await safeDeleteStorage(ctx, article.coverVideoPosterStorageId);
  }
}
```

Notably, `replacedVideo` is NOT in this condition. That's intentional and correct: when Branch 2 fires (video changed) but the caller reuses the same poster id (`replacedPoster=false`), the old poster blob equals the new poster blob — deleting it would break the freshly-written reference.

This is non-obvious from reading the code. The condition list reads like an oversight: "we delete the prior video on replacedVideo, but not the prior poster?" — the answer is "because Branch 2 always patches `coverVideoPosterStorageId` to args.coverVideoPosterStorageId, and if that equals the old poster id, deleting it would delete the live blob."

A future reader will inevitably "fix" this perceived bug and break the row in production.

- **Source:** Code review of PLAN_010 article-cover-video branch
- **Location:** `packages/convex/convex/articles/mutations.ts:495-499`
- **Evidence:** Three independent delete blocks with overlapping but distinct conditions; no comment explaining why poster preservation differs.

## Goal

A future reader sees the condition and immediately understands why it's correct.

## Scope

- Add a comment block above the third delete branch.

## Out of Scope

- Refactoring the branch logic (FG_180 covers Branch 2 edge cases).
- Removing the existing inline comments at lines 487-490.

## Approach

Comment-only change:

```ts
// The poster-delete condition deliberately omits replacedVideo. When
// Branch 2 fires with a same-id poster (replacedPoster=false), the prior
// poster IS the new poster — the row's coverVideoPosterStorageId still
// references the same blob we'd otherwise delete. Only delete when the
// poster id actually changed (replacedPoster) or the entire cover surface
// is being wiped (clearedAllCover, replacedImage).
if (clearedAllCover || replacedImage || replacedPoster) {
  …
}
```

- **Effort:** Small
- **Risk:** Low (comment only)

## Implementation Steps

1. Add the comment block above the third `if` in `mutations.ts`.
2. Run `pnpm --filter=@feel-good/convex test` (existing tests should pass — no behavior change).

## Constraints

- Comment must be terse — under ~6 lines.
- Cite the invariant: "reusing same poster id = no delete needed."

## Resources

- Source: `packages/convex/convex/articles/mutations.ts:481-499`
- Related: FG_180 (Branch 2 poster-only edge)
