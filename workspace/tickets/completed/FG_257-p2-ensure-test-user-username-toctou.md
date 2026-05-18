---
id: FG_257
title: "ensureTestUser rejects contended username claims under parallel workers"
date: 2026-05-18
type: fix
status: completed
priority: p2
description: "ensureTestUser reads username owners then patches its own row to claim the username, so two parallel workers claiming the same username write different documents, both commit, and the by_username index becomes non-unique with no error."
dependencies: ["FG_249"]
acceptance_criteria:
  - "ensureTestUser re-reads the by_username owners immediately before its final ctx.db.patch and throws a descriptive error if a non-self @mirror.test row still holds the username"
  - "The ensureTestUser JSDoc documents that callers must supply a globally unique username per concurrent worker"
  - "`grep -n by_username packages/convex/convex/auth/testHelpers.ts` shows a second owners read after the cleanup loop inside the ensureTestUser handler"
  - "`pnpm --filter=@feel-good/convex test` passes for testHelpers-related specs (pre-existing unrelated convex test failures are out of scope)"
---

# ensureTestUser rejects contended username claims under parallel workers

## Context

`ensureTestUser` (packages/convex/convex/auth/testHelpers.ts, ~197-272) reads `usernameOwners` via the `by_username` index to block non-test claimants, runs its cleanup loop, then patches its own `existing` row to set `username = args.username`. The check and the write are atomic within one mutation, but two concurrent mutations claiming the **same** username operate on **different** document ids — Convex OCC sees no write-write conflict, both pass the owner check against a pre-commit snapshot, and both commit. The `users` table then has two rows with the same username and every `.withIndex("by_username").unique()` caller throws.

Found in code review (concurrency reviewer, confidence 0.85). Today only the FG_230 fixture design (per-test `pla-<pid>-<ts>` usernames) prevents this; nothing in the mutation or schema enforces it. The `by_username` index is non-unique, so this is a latent corruption the moment any spec reuses a literal username across workers.

## Scope

- Add a post-cleanup contention check before the final username patch.
- Document the unique-username-per-worker invariant in the function JSDoc.

## Approach

After the cleanup loop and immediately before `ctx.db.patch(existing._id, { username })`, re-query `by_username` and throw a descriptive serialization error if any non-self `@mirror.test` row still holds the username. This converts a silent double-write into a loud, retryable failure.

## Implementation Steps

1. Read packages/convex/convex/auth/testHelpers.ts ensureTestUser handler (~197-272) and users/schema.ts (confirm `by_username` is non-unique).
2. Add the re-read + throw immediately before the final `ctx.db.patch` username write.
3. Add the "callers must supply a globally unique username per concurrent worker" note to the ensureTestUser JSDoc.
4. Run `pnpm --filter=@feel-good/convex test`.

## Constraints

- Depends on FG_249 (already completed; same file `testHelpers.ts`) — read the current file state before editing; the resetTestUser region was already changed.
