---
id: FG_252
title: "Post delete logic lives in a single parameterized hook"
date: 2026-05-18
type: refactor
status: completed
priority: p1
description: "use-list-delete-post.ts duplicated roughly eighty-five percent of use-delete-post.ts including the copy-pasted withOptimisticUpdate filter, the same twin-drift smell PostLayout was extracted to eliminate one level down."
dependencies: []
acceptance_criteria:
  - "The withOptimisticUpdate filter exists in exactly one source file"
  - "Both DeletePostConnector (detail) and PostListDeleteDialog (list) consume the one unified hook"
  - "use-list-delete-post.ts is a thin re-export with no second optimistic block"
  - "mirror build and unit tests pass"
---

# Post delete logic lives in a single parameterized hook

## Context

`use-list-delete-post.ts` was a near-verbatim copy of `use-delete-post.ts` differing only in late-bound target ref and the omission of `router.replace`. The copy-pasted optimistic block was the twin-drift failure mode PostLayout was extracted to fix. Found in code review (maintainability, confidence 0.87).

## Resolution

`useDeletePost` is now a two-mode hook: `{ postId }` (eager/detail, fires `router.replace` before the mutation resolves — FG_168 invariant preserved) or `{ username }` (late-bound list, exposes `requestDelete(post)`, no navigation). `use-list-delete-post.ts` is a 7-line re-export (`export { useDeletePost as useListDeletePost }`). `DeletePostConnector` and `PostListDeleteDialog` both consume the unified hook. Verifier APPROVED: single `args.ids.includes` site, 0 `withOptimisticUpdate` in the wrapper, 333/333 unit tests pass, mirror build exit 0; e2e cannot-run (environment) accepted on build+unit+code-read confidence. Survived the worktree git-clobber intact.

> Process note: this ticket's executor ran a `git stash` "build test" in the shared worktree, which reverted the other three Wave-1 executors' uncommitted tracked changes. Recovered by the orchestrator. See workspace/lessons.md.
