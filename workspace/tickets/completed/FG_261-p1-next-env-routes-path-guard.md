---
id: FG_261
title: "next-env.d.ts cannot regress to the dev-server routes path again"
date: 2026-05-22
type: chore
status: completed
priority: p1
description: "Code review on branch hpark0011/post-edit-route-error caught apps/mirror/next-env.d.ts re-imported './.next/dev/types/routes.d.ts' instead of './.next/types/routes.d.ts'. This is the exact regression fixed on 2026-05-07 in commit 2f37d72a — `next dev` rewrites the file to the dev variant on startup and `next build` rewrites it back to the prod variant, so committing the dev form guarantees CI diff churn and a silently dirty worktree. The file carries a 'should not be edited' notice. Add a guard so the regression cannot land a third time: the cheapest credible shape is a vitest unit test that reads the file and asserts the prod import string. A pre-commit hook is the alternative if the team wants to start a husky setup, but that is heavier and would be the first hook in this repo."
dependencies: []
acceptance_criteria:
  - "A test exists that reads apps/mirror/next-env.d.ts and asserts the file contains the literal string `import \"./.next/types/routes.d.ts\";`."
  - "grep -F './.next/dev/types/routes.d.ts' apps/mirror/next-env.d.ts returns no matches."
  - "Running the new test against the dev-variant content (manually swap the import to confirm) fails with a message that names commit 2f37d72a or this ticket so a future reader can trace why the assertion exists."
  - "pnpm --filter=@feel-good/mirror test:unit passes after the guard is added."
  - "pnpm --filter=@feel-good/mirror lint passes."
---

# next-env.d.ts cannot regress to the dev-server routes path again

## Context

`/review-code` on branch `hpark0011/post-edit-route-error` (2026-05-22) flagged `apps/mirror/next-env.d.ts:3` for re-importing `./.next/dev/types/routes.d.ts`. The repo has been here before — commit `2f37d72a` ("fix(mirror): restore next-env.d.ts prod routes path", 2026-05-07) reverted the identical change with the message: "The dev-server variant ... was an accidental commit from a local `next dev` run. `next build` regenerates the file pointing back at ./.next/types/routes.d.ts, so leaving the dev variant tracked guarantees CI diff churn."

A sub-agent reverted the file mid-review in the current worktree, so the worktree is already clean. But there is no guard — the next agent or contributor running `pnpm dev` and `git add -A` will commit the same drift again. This is the second occurrence in 15 days; institutionalise the fix.

The file carries `// NOTE: This file should not be edited` (per Next.js docs at https://nextjs.org/docs/app/api-reference/config/typescript), so a hand edit is always a regression — the assertion is unambiguous.

## Scope

- Add a vitest unit test under `apps/mirror/` that reads `apps/mirror/next-env.d.ts` and asserts the prod import literal.
- The test failure message names the prior commit (`2f37d72a`) and/or this ticket so a future agent immediately sees the recurrence pattern instead of just "string mismatch".

## Approach

Smallest credible guard is a one-file vitest test. The Mirror app already runs `pnpm test:unit` as part of CI, so the guard piggybacks on existing infrastructure with zero new tooling. Place the test where contributors are most likely to see it when the file changes — colocated under `apps/mirror/__tests__/` (or `apps/mirror/lib/__tests__/`) with a name that signals what it protects, e.g. `next-env-routes-path.test.ts`.

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("next-env.d.ts", () => {
  it("imports the prod routes types, not the dev-server variant", () => {
    const file = readFileSync(
      resolve(__dirname, "../../next-env.d.ts"),
      "utf8",
    );
    expect(
      file,
      "next-env.d.ts must import ./.next/types/routes.d.ts (not the dev variant). " +
        "Regression of commit 2f37d72a (FG_261). `next dev` rewrites this file " +
        "to the dev path on startup; commit the prod form only.",
    ).toContain('import "./.next/types/routes.d.ts";');
  });
});
```

The custom message in the second arg to `expect(...)` is the load-bearing part — when this fires in three months a stranger reads the message, finds the prior commit, and understands the recurrence pattern without spelunking.

A pre-commit hook is the alternative, but the repo has no husky setup today; starting one for a single check is heavier than the test-based guard and adds a new local-dev requirement. Defer that until there's a second motivating check.

## Implementation Steps

1. Confirm the worktree state: `git status -- apps/mirror/next-env.d.ts` (should be clean post-revert) and `grep -F './.next/types/routes.d.ts' apps/mirror/next-env.d.ts` (should match line 3).
2. Create `apps/mirror/__tests__/next-env-routes-path.test.ts` with the snippet above. Confirm the existing vitest config picks up `apps/mirror/__tests__/` (or place under the matching directory the config already globs).
3. Run `pnpm --filter=@feel-good/mirror test:unit -- run next-env-routes-path` and confirm it passes.
4. Smoke-check the failure path: temporarily swap the import to the dev variant, rerun the test, confirm the message names commit `2f37d72a` / `FG_261`, then revert.
5. Run `pnpm --filter=@feel-good/mirror lint` and `pnpm --filter=@feel-good/mirror test:unit` to confirm no collateral breakage.

## Out of Scope

- Adding a husky / pre-commit hook setup to the monorepo. Defer until there's a second check that warrants the infrastructure cost.
- Modifying `.gitignore` to exclude `next-env.d.ts` — Next.js docs require it to be committed.
- Touching the Next.js toolchain to stop rewriting the file in `next dev` (upstream Next behavior; not our surface).

## Resources

- Prior fix: commit `2f37d72a` ("fix(mirror): restore next-env.d.ts prod routes path", 2026-05-07).
- Lesson context: `workspace/lessons.md` does not yet have an entry for this drift — consider adding one in the same PR.
- Next.js docs: https://nextjs.org/docs/app/api-reference/config/typescript
