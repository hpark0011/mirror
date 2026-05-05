---
id: FG_133
title: "restore-env-local.sh writes localhost:3001 (matching the example file)"
date: 2026-05-05
type: fix
status: to-do
priority: p2
description: "The worktree env-recovery script still echoes localhost:3000 while the example file was bumped to 3001, silently reverting the port on every recovery."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "`grep -n 'localhost:3000' scripts/restore-env-local.sh` returns no matches."
  - "`grep -n 'localhost:3001' scripts/restore-env-local.sh` returns the previously-3000 line."
  - "Running `./scripts/restore-env-local.sh` in a worktree produces an `apps/mirror/.env.local` whose `NEXT_PUBLIC_SITE_URL=http://localhost:3001`."
owner_agent: "devops / shell-script maintainer"
---

# restore-env-local.sh writes localhost:3001 (matching the example file)

## Context

Surfaced by the PR #34 code review (`code-review-pr34` batch); also raised by CodeRabbit (PR thread r3180086635). This branch correctly bumps `apps/mirror/.env.local.example` from `localhost:3000` to `localhost:3001`, but `scripts/restore-env-local.sh:69` still writes `NEXT_PUBLIC_SITE_URL=http://localhost:3000`.

The script is the documented worktree-recovery path (see `.claude/rules/worktrees.md` and `AGENTS.md` deploy footguns). Running it after a clobbered `.env.local` (a known Vercel CLI footgun in worktrees) silently reverts the port across every worktree because the file is symlinked.

**Risk:** running the documented recovery script breaks auth redirects and Convex `SITE_URL` coordination in local dev — and the breakage is invisible until OAuth callbacks fail.

## Goal

The restore script writes `localhost:3001`, matching the canonical example file.

## Scope

- Single-line change to `scripts/restore-env-local.sh`.

## Out of Scope

- Other env vars in the script.
- Refactoring the script.

## Approach

One-line edit.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Edit `scripts/restore-env-local.sh:69` from `localhost:3000` to `localhost:3001`.
2. Run `./scripts/restore-env-local.sh` (in a disposable env, NOT main) and verify the resulting `.env.local` has the corrected port.

## Constraints

- Do not modify any other line in the script.
- Do not bypass `.env.local` symlink protections — the script is intentionally the only blessed restore path.

## Resources

- PR #34: https://github.com/hpark0011/mirror/pull/34
- CodeRabbit thread: https://github.com/hpark0011/mirror/pull/34#discussion_r3180086635
- `.claude/rules/worktrees.md`
