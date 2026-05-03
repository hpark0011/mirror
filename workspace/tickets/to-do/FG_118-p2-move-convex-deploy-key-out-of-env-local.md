---
id: FG_118
title: "apps/mirror/.env.local does not contain CONVEX_DEPLOY_KEY so convex dev targets dev"
date: 2026-05-03
type: chore
status: to-do
priority: p2
description: "apps/mirror/.env.local contains a CONVEX_DEPLOY_KEY=prod:famous-cricket-102|... value that silently overrides CONVEX_DEPLOYMENT and routes every npx convex dev invocation at the production deployment, even when the developer thinks they are targeting dev. Discovered during the FG_094 / FG_117 investigation when the executor had to work around the override with env -u CONVEX_DEPLOY_KEY. This is a per-developer footgun (the file is git-ignored so the prod key doesn't ship to other contributors), but every fresh clone that copies this pattern will route convex dev to prod by accident. Remove the line, document the correct home for the deploy key (Vercel build env per AGENTS.md, or per-developer secrets store outside the repo), and add a guard note to .claude/rules/auth.md or packages/convex/AGENTS.md so future contributors don't reintroduce the override."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "grep CONVEX_DEPLOY_KEY apps/mirror/.env.local returns 0 matches"
  - "Either .claude/rules/auth.md or packages/convex/AGENTS.md gains a section warning that CONVEX_DEPLOY_KEY in .env.local silently routes `convex dev` to prod (grep CONVEX_DEPLOY_KEY .claude/rules/auth.md packages/convex/AGENTS.md returns at least one match in a `do not put this in .env.local` context, with a one-line statement of where it SHOULD live)"
  - "From `packages/convex/`, `npx convex dev --once 2>&1 | grep -E 'famous-cricket-102|prod:'` returns 0 matches AND the deploy succeeds against the dev deployment (proves no leftover routing-to-prod behavior; verify by checking the printed deployment name is the dev one, e.g. quick-turtle-404)"
  - "pnpm --filter=@feel-good/mirror build still passes (the env removal must not break the Mirror build, which reads non-deploy-key Convex env vars)"
owner_agent: "Convex / DX specialist"
---

# apps/mirror/.env.local does not contain CONVEX_DEPLOY_KEY so convex dev targets dev

## Context

Discovered during the FG_094 investigation (resolving-tickets batch, 2026-05-03)
and re-confirmed during FG_117 prep. The file `apps/mirror/.env.local` carries a
production-scoped Convex deploy key:

```
CONVEX_DEPLOY_KEY=prod:famous-cricket-102|...
```

Per the saved project memory `feedback_convex_deploy_key_precedence`:
> `CONVEX_DEPLOY_KEY` overrides `CONVEX_DEPLOYMENT` and silently routes `convex dev`
> to prod. Never pass `--env-file` to convex CLI without grepping for `CONVEX_DEPLOY_KEY`.

The FG_094 executor hit this directly: `npx convex dev --once` from
`packages/convex/` was deploying to `famous-cricket-102` (prod) instead of
`quick-turtle-404` (dev). The workaround was `env -u CONVEX_DEPLOY_KEY npx convex
dev --once` to remove the override at the shell level. That works for one
developer who knows about the gotcha, but every fresh clone or new contributor
that follows the apparent `.env.local` pattern will route their dev work at
production by accident.

This is NOT a security issue — `.env.local` is git-ignored and the key is per-
developer. It IS a developer-experience footgun severe enough that one of the
project's saved memories is dedicated to remembering it. The fix is to remove
the line from `.env.local` and document the correct home for the key so the
gotcha doesn't recur.

## Goal

After this ticket, running `npx convex dev --once` from a fresh checkout (with
`apps/mirror/.env.local` configured per the documented pattern) targets the
dev Convex deployment, not production. A note in either `.claude/rules/auth.md`
or `packages/convex/AGENTS.md` warns future contributors against placing
`CONVEX_DEPLOY_KEY` in `.env.local`.

## Scope

- Remove the `CONVEX_DEPLOY_KEY=prod:...` line from `apps/mirror/.env.local`.
- Add a brief warning + correct-home note to whichever of `.claude/rules/auth.md`
  or `packages/convex/AGENTS.md` is the better fit (auth.md already has a
  "Monorepo deploy gotcha" section; that's the natural home).
- Verify `npx convex dev --once` from the worktree (no env-override) routes to
  dev, not prod.

## Out of Scope

- Auditing other `.env*` files in the monorepo for similar overrides — none are
  known to exist; if any do, file separately.
- Changing how Vercel build deployments authenticate (the `CONVEX_DEPLOY_KEY` IS
  required there per the AGENTS.md deploy gotcha; this ticket is about local
  dev only).
- Refactoring `convex dev` invocation patterns in any scripts — current scripts
  are fine once the override is gone.
- Deleting or rotating the prod deploy key itself — it's per-developer; whoever
  has it can keep it, just NOT in `.env.local`.

## Approach

Two-line change to `.env.local` (remove the offending line), plus a paragraph
added to the existing "Monorepo deploy gotcha" section of `.claude/rules/auth.md`
explaining (a) where the key SHOULD live (Vercel project env vars for builds;
shell-level export or `~/.config/...` for local manual deploys), and (b) why
`.env.local` is the wrong home (Convex CLI reads `CONVEX_DEPLOY_KEY` and treats
it as authoritative over `CONVEX_DEPLOYMENT`, so it silently routes `convex dev`
at the deployment the key targets — production, in this case).

The warning paragraph should be discoverable via `grep CONVEX_DEPLOY_KEY
.claude/rules/`, so future readers searching for the variable name find the
note before they accidentally reintroduce it.

- **Effort:** Small
- **Risk:** Low — removing a key local-only contributors set themselves; no
  shared CI or build pipeline reads `apps/mirror/.env.local`.

## Implementation Steps

1. Edit `apps/mirror/.env.local` and delete the `CONVEX_DEPLOY_KEY=prod:...`
   line. Leave the surrounding Convex env vars (`CONVEX_DEPLOYMENT`,
   `NEXT_PUBLIC_CONVEX_URL`, etc.) intact. Do NOT commit the file — it's
   git-ignored. The change is local-only; this step is a heads-up for the
   developer running the ticket.
2. Open `.claude/rules/auth.md`. Find the "Monorepo deploy gotcha" section
   referenced from the root `AGENTS.md`. Add a sub-heading like "CONVEX_DEPLOY_KEY
   stays out of .env.local" with three sentences: (a) the key overrides
   `CONVEX_DEPLOYMENT` and silently routes `convex dev` to whichever deployment
   the key targets (prod, for the production key); (b) Vercel project env vars
   are the only place a `prod:` key belongs in this monorepo; (c) for local
   manual deploys against prod, export the key in the shell for the single
   command (`CONVEX_DEPLOY_KEY=... npx convex deploy`) rather than persisting
   it.
3. From `packages/convex/`, run `npx convex dev --once 2>&1 | tail -10` and
   confirm the printed deployment name is `quick-turtle-404` (or whichever
   dev deployment is configured), NOT `famous-cricket-102`. If the run still
   targets prod, step 1 wasn't fully applied — re-check the .env.local file.
4. From the worktree root, run `pnpm --filter=@feel-good/mirror build`. Expect
   exit 0. (Mirror reads `NEXT_PUBLIC_CONVEX_URL` and other non-deploy-key env
   vars; removing the deploy key shouldn't affect build, but verify.)

## Manual Verification

The "convex dev targets dev not prod" check is genuinely manual because the
`.env.local` file is per-developer and git-ignored. The ticket's resolver
verifies it on their own machine. A reviewer accepts on the basis of:
- Step 3's output showing `quick-turtle-404` (or the configured dev name).
- The step-2 documentation note being discoverable via `grep CONVEX_DEPLOY_KEY .claude/rules/`.
- The committed change to `.claude/rules/auth.md` (the only file that should
  appear in `git status` for this ticket).

## Constraints

- Do NOT commit `apps/mirror/.env.local` — it's listed in `.gitignore` and
  contains per-developer secrets. Only the documentation file change goes in
  the commit.
- The doc note MUST mention `CONVEX_DEPLOY_KEY` by name so a future search hits
  it. Implicit references ("the deploy key" without naming it) defeat the
  purpose.
- Do NOT change Vercel deployment configuration as part of this ticket — Vercel
  setting the key in build env is correct and stays.

## Resources

- Saved memory `feedback_convex_deploy_key_precedence` (`/Users/disquiet/.claude/projects/-Users-disquiet-Desktop-mirror/memory/`):
  documents the precedence rule and that this exact scenario already burned
  the user once.
- `AGENTS.md` § Deploy & Build Footguns — pointer to `.claude/rules/auth.md` §
  Monorepo deploy gotcha. The new sub-section lives in that file.
- FG_117 ticket body — references the workaround used while this ticket is
  outstanding.
- Convex CLI documentation on `CONVEX_DEPLOY_KEY` precedence (verify via
  `npx convex --help` or current Convex docs before authoring the rule
  text — vendor docs change).
