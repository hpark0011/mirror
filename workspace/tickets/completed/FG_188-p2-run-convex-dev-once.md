---
id: FG_188
title: "Run convex dev --once against the worktree to confirm schema push succeeds"
date: 2026-05-08
type: chore
status: completed
priority: p2
description: "The branch contains schema additions and 6 new mutations but no _generated/ diff. Build re-derives types from source so no static drift, but convex dev --once was never run to confirm the schema push actually succeeds against a real deployment."
dependencies: []
parent_plan_id: PLAN_010
acceptance_criteria:
  - "`pnpm --filter=@feel-good/convex exec convex dev --once` runs to completion without errors"
  - "`git status packages/convex/convex/_generated/` shows any updated files committed (or confirms no changes)"
  - "PR description includes a note: 'schema push verified via convex dev --once on worktree deployment <slug>'"
  - "`pnpm --filter=@feel-good/mirror build` continues to pass"
owner_agent: "DevOps Engineer"
---

# Run convex dev --once Against the Worktree to Confirm Schema Push Succeeds

## Context

`git diff main...HEAD -- packages/convex/convex/_generated/` returns zero lines on this branch. The PR adds:
- Two new optional fields to `articleFields` in `schema.ts`
- Five new exported mutations in `articles/mutations.ts`
- Three new entries in `STORAGE_FIELD_REFERENCES`

`api.d.ts` and `dataModel.d.ts` re-derive their type shapes from source at compile time (`ApiFromModules<typeof articles_mutations>` and `DataModelFromSchemaDefinition<typeof schema>`), so static drift is impossible — the build catches any inconsistency. `api.js` is a Proxy, so it's runtime-dynamic.

What the absent `_generated/` diff DOES indicate: nobody ran `npx convex dev` against the worktree's deployment. That command is the canonical "does this schema actually push successfully?" check. Convex's deploy server performs additional validation beyond what `pnpm build` runs (validator-vs-existing-data compatibility, codegen freshness, etc.). A schema that compiles locally can still be rejected at push time.

Per `.claude/rules/worktrees.md`, every worktree should have its own dev deployment. Running `convex dev --once` is a one-command verification.

- **Source:** Code review of PLAN_010 article-cover-video branch
- **Location:** `packages/convex/convex/_generated/` (empty diff) and `packages/convex/.env.local` (worktree's deployment slug)
- **Evidence:** No updates to generated files even though schema and mutations changed.

## Goal

The schema push has been verified against the worktree's Convex deployment, and any resulting codegen updates are committed. The PR description records the verification.

## Scope

- Run `pnpm --filter=@feel-good/convex exec convex dev --once`.
- Commit any resulting `_generated/` updates.
- Add a one-line note to the PR description confirming the verification.

## Out of Scope

- Setting up CI to run this on every PR (separate ops ticket).
- Verifying against production (the worktree deployment is a sibling dev deployment).
- Refactoring the codegen pipeline.

## Approach

Standard Convex worktree workflow per `.claude/rules/worktrees.md`. The worktree should already have a per-worktree deployment provisioned via `provision-worktree-convex.sh`.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Confirm `packages/convex/.env.local` exists in the worktree and points at this branch's dev deployment (`grep CONVEX_DEPLOYMENT packages/convex/.env.local`).
2. Run `pnpm --filter=@feel-good/convex exec convex dev --once`. Watch for schema-push errors.
3. If the command succeeds and modifies anything in `_generated/`, run `git add packages/convex/convex/_generated/ && git commit -m "chore(articles): regenerate Convex codegen for cover-video mutations"`.
4. If no changes appear, that's expected — re-derived types only update when the underlying source changes in a way that affects the snapshot.
5. Add a note to the PR description: "Schema push verified via `convex dev --once` against worktree deployment `<slug>`."
6. Run `pnpm --filter=@feel-good/mirror build` as a final sanity check.

## Constraints

- Do NOT run `convex deploy` (production) — only `convex dev --once` against the worktree's dev deployment.
- Do NOT pass `--env-file` or any flag that could route the CLI to a different deployment.
- See `.claude/rules/auth.md` § "CONVEX_DEPLOY_KEY stays out of .env.local" — ensure the deploy key is not in any auto-loaded env file.

## Resources

- `.claude/rules/worktrees.md` — per-worktree deployment workflow
- `.claude/rules/auth.md` — CONVEX_DEPLOY_KEY hygiene
- `packages/convex/.env.local` — the worktree's deployment slug
