---
id: FG_213
title: "Convex codegen lists the new content authoring helper modules"
date: 2026-05-14
type: chore
status: completed
priority: p2
description: "PLAN_013 added `articles/writeHelpers.ts`, `posts/writeHelpers.ts`, and `content/agentBody.ts` but the committed `_generated/api.d.ts` was not regenerated — sibling helper files like `bio/writeHelpers` and `contacts/writeHelpers` are present in the module map. Runtime function registration for `applyContentPatch` still works because it lives in `chat/toolMutations.ts` which is registered, but the codegen-commit convention is broken and a future codegen run will produce unrelated diff churn."
dependencies: []
parent_plan_id: workspace/plans/2026-05-14-config-agent-content-authoring-plan.md
acceptance_criteria:
  - "`grep -c 'articles/writeHelpers' packages/convex/convex/_generated/api.d.ts` returns >= 1."
  - "`grep -c 'posts/writeHelpers' packages/convex/convex/_generated/api.d.ts` returns >= 1."
  - "`grep -c 'content/agentBody' packages/convex/convex/_generated/api.d.ts` returns >= 1."
  - "Running `pnpm exec convex codegen` (or the repo's equivalent) from `packages/convex/` after the commit produces no further diff."
  - "`pnpm --filter=@feel-good/convex check-types` exits 0."
owner_agent: "Convex codegen runner"
---

# Convex codegen lists the new content authoring helper modules

## Context

Code review on branch `hpark0011/explain-profile-config-agent` (P2, data-integrity lane). `git diff origin/main -- packages/convex/convex/_generated/` shows zero changes, yet three new module files were added. The repo convention (visible in existing diffs: `bio/writeHelpers` and `contacts/writeHelpers` are listed at lines 30 and 52 of `_generated/api.d.ts`) is to commit codegen output. The data-integrity reviewer initially rated this P0 with a runtime-failure claim, but verification confirmed runtime is unaffected: the three new helper modules contain no `internalMutation`/`internalQuery`/etc. definitions, so they don't require registry entries, and `chat/toolMutations.ts` (which IS registered) is what exposes `applyContentPatch`. The remaining concern is hygiene: the commit log will diverge, future PRs will pick up the stale codegen as noise, and a future contributor running `convex dev` locally will see an unexplained diff.

## Goal

Codegen output matches source; future PRs do not pick up unrelated codegen churn for these modules.

## Scope

- Re-run Convex codegen for `packages/convex/`.
- Commit the regenerated `_generated/api.d.ts` and `_generated/api.js`.

## Out of Scope

- Adding the helpers to `internal.*` runtime callable surface (they are intentionally not Convex functions — only the auth/internal mutations are).
- Auditing other potentially-stale generated files.

## Approach

Run codegen from the `packages/convex/` directory and commit only the resulting diff in `_generated/`.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. `cd packages/convex && pnpm exec convex codegen` (or `npx convex codegen` if pnpm doesn't expose it).
2. `git diff packages/convex/convex/_generated/` — verify only the expected three module entries are added.
3. Run `pnpm --filter=@feel-good/convex check-types` and `pnpm --filter=@feel-good/mirror build`.
4. Commit only the `_generated/` diff.

## Constraints

- Do not edit `_generated/` files by hand.
- If codegen surfaces unrelated drift (other stale entries), file a separate ticket; do not bundle.

## Resources

- `packages/convex/CLAUDE.md` — codegen guidance.
- `convex/_generated/api.d.ts` reference layout (bio/contacts patterns).
