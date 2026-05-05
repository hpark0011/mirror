---
id: FG_131
title: "Cancel on the new-article page uses router.replace instead of router.push"
date: 2026-05-05
type: fix
status: to-do
priority: p2
description: "Cancelling a new article leaves /articles/new in browser history, so the Back button reopens a stale empty editor instead of returning to the prior page."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "`grep -n 'router.push' apps/mirror/features/articles/components/new-article-editor.tsx` returns no matches in the Cancel handler."
  - "Manual test: visit `/@user/articles/new`, click Cancel, then Back — the browser does NOT return to the empty new-article page."
  - "`pnpm build --filter=@feel-good/mirror` passes."
owner_agent: "frontend engineer (React)"
---

# Cancel on the new-article page uses router.replace instead of router.push

## Context

Surfaced by the PR #34 code review (`code-review-pr34` batch); also raised by CodeRabbit (PR thread r3180086690). `apps/mirror/features/articles/components/new-article-editor.tsx:39` calls `router.push(\`/@${username}/articles\`)` in the `onCancel` handler. Cancel discards the in-memory draft, so leaving the cancelled page in browser history is misleading: the Back button reopens a stale empty editor instead of returning the user to the page they came from before clicking New.

**Risk:** confusing UX where Back doesn't undo the cancel — users may think their draft is preserved, then discover it's gone after typing a few keystrokes.

## Goal

Cancelling a new article does not leave the new-article URL in browser history; Back returns the user to the article list (or wherever they came from before).

## Scope

- Replace `router.push` with `router.replace` in the Cancel handler.

## Out of Scope

- Changing the cancel destination URL.
- Adding a confirmation dialog before cancel.

## Approach

One-line change.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Edit `apps/mirror/features/articles/components/new-article-editor.tsx:39`: change `router.push(...)` to `router.replace(...)`.
2. Manually verify Back behavior in dev.

## Constraints

- Do not change the destination URL.

## Resources

- PR #34: https://github.com/hpark0011/mirror/pull/34
- CodeRabbit thread: https://github.com/hpark0011/mirror/pull/34#discussion_r3180086690
