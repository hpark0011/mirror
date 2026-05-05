---
id: FG_152
title: "Optimistic publishedAt timestamp updates correctly on republish"
date: 2026-05-05
type: fix
status: to-do
priority: p3
description: "After draft→publish→draft→publish, the optimistic publishedAt stays at the first publish time until the reactive query corrects it, briefly showing the wrong date."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "`apps/mirror/features/articles/hooks/use-edit-article-form.tsx:togglePublish` clears `publishedAt` to `null` when transitioning to `'draft'`."
  - "The `if (targetStatus === 'published' && !publishedAt)` guard either checks against the new state or is removed so the local timestamp re-sets on every publish transition."
  - "Manual test: publish → unpublish → publish — the displayed publication date reflects the new publish time, not the first one."
  - "`pnpm build --filter=@feel-good/mirror` passes."
owner_agent: "frontend engineer (React)"
---

# Optimistic publishedAt timestamp updates correctly on republish

## Context

Surfaced by the PR #34 code review (`code-review-pr34` batch; reliability reviewer). `apps/mirror/features/articles/hooks/use-edit-article-form.tsx:115-117` writes `setPublishedAt(Date.now())` after a successful publish, guarded by `if (targetStatus === 'published' && !publishedAt)`. If the user unpublishes (sets status to `'draft'`) and then publishes again, `publishedAt` in local state is still the first-publish timestamp (never cleared on unpublish), so the guard is `false` and `setPublishedAt` is skipped. The visible publication date stays the FIRST publish time until the reactive query corrects it (~200-500ms).

**Risk (low):** transient cosmetic wrongness; risk escalates if a user screenshots or shares the wrong date during the optimistic window.

## Goal

The displayed publication date always reflects the most recent publish action during the optimistic window.

## Scope

- Clear `publishedAt` to `null` when `togglePublish` transitions to `'draft'`.
- Re-set `publishedAt` to `Date.now()` on every publish transition (drop the `!publishedAt` guard, or check against the just-cleared state).

## Out of Scope

- Server-side publish/unpublish behavior.
- Wider refactor of the optimistic state.

## Approach

Two-line change inside `togglePublish`.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. In `apps/mirror/features/articles/hooks/use-edit-article-form.tsx:togglePublish`, after `await persist(nextStatus)` and `setStatus(nextStatus)`, add: `if (nextStatus === 'draft') setPublishedAt(null);`.
2. In `persist`, change the guard at lines 115-117 to remove `!publishedAt` so the optimistic re-set runs on every publish: `if (targetStatus === 'published') setPublishedAt(Date.now());`.
3. Manually verify the publish→unpublish→publish flow shows the correct timestamps in dev.

## Constraints

- Must not regress the initial-publish path (first publish should still optimistically set `publishedAt`).
- Reactive-query correction still wins eventually; this only fixes the brief optimistic window.

## Resources

- PR #34: https://github.com/hpark0011/mirror/pull/34
