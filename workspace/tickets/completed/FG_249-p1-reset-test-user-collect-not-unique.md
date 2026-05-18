---
id: FG_249
title: "resetTestUser survives duplicate users rows for one test email"
date: 2026-05-18
type: fix
status: completed
priority: p1
description: "resetTestUser queried users by_email with .unique() but ensureTestUser on this branch now intentionally allows multiple rows per test email, so reset threw at runtime and silently leaked onboarded state into the next spec."
dependencies: []
acceptance_criteria:
  - "The resetTestUser handler uses .collect() on the by_email index, not .unique()"
  - "It selects the row via the same authId-preference (fallback rows[0]) used by ensureTestUser"
  - "A convex-test inserts two users rows for one @mirror.test email and asserts resetTestUser does not throw and resets the primary row"
  - "pnpm --filter=@feel-good/convex test passes for resetTestUser.test.ts"
---

# resetTestUser survives duplicate users rows for one test email

## Context

This branch changed `ensureTestUser` from `.unique()` to `.collect()` because dev/test deployments accumulate a synthetic `test_<email>` auth row alongside the real Better Auth row. `resetTestUser` was not updated — its `by_email` lookup still called `.unique()`, which Convex throws on when more than one document matches. Found in code review (correctness + data-integrity, merged, confidence 0.98).

## Resolution

`resetTestUser` now `.collect()`s and prefers the non-synthetic row, mirroring `ensureTestUser`. New regression test `packages/convex/convex/auth/__tests__/resetTestUser.test.ts` (3 cases incl. duplicate-row). Verifier APPROVED — 3/3 tests pass; the 2 unrelated convex test failures are pre-existing concurrent-ticket noise. Recovered after a worktree git-clobber and re-verified.
