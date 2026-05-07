---
id: FG_165
title: "Worktree migration auto-allowlists the owner's email"
date: 2026-05-07
type: improvement
status: to-do
priority: p2
description: "Patch the per-worktree dev migration so the owner's git email is added to betaAllowlist automatically, eliminating the unable_to_create_user wall on first Google sign-in."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "Running `./scripts/sync-worktree-convex-secrets.sh` in a fresh worktree inserts `git config user.email` into `betaAllowlist`. Verify with `pnpm --filter=@feel-good/convex exec convex data betaAllowlist | grep -Fi \"$(git config user.email)\"` returning at least one row."
  - "Re-running `./scripts/sync-worktree-convex-secrets.sh` does not duplicate the row. Verify by running it twice and asserting `convex data betaAllowlist` row count for that email stays at 1."
  - "`.claude/rules/worktrees.md` migration block documents the auto-allowlist behavior. Verify with `grep -n betaAllowlist .claude/rules/worktrees.md` returning at least one match."
  - "The change is dev-only. Verify with `grep -rn betaAllowlist scripts/` only matching the new line in `sync-worktree-convex-secrets.sh` (no deploy-time hooks)."
  - "Script aborts with a clear error if `git config user.email` is empty (rather than silently skipping or inserting an empty-string row). Verify by running the script with `GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null` and confirming non-zero exit + a message naming the missing config."
owner_agent: "Convex/worktree tooling implementer (familiar with shell scripts and Convex internalMutation invocation)"
---

# Worktree migration auto-allowlists the owner's email

## Context

Per `.claude/rules/worktrees.md`, every worktree provisions its own dev Convex
deployment via `pnpm --filter=@feel-good/convex dev` → "create a new project".
The migration block then runs `./scripts/sync-worktree-convex-secrets.sh` (env)
and `pnpm --filter=@feel-good/convex exec convex run seed:seedRickRubinDemo`
(demo workspace data).

The fresh deployment's `betaAllowlist` table is empty — the seed only inserts
the Rick Rubin demo user. The auth flow has a `user.onCreate` trigger
(`packages/convex/convex/auth/client.ts`) that throws `BETA_CLOSED: <email>`
for any email not in `betaAllowlist`, which Better Auth surfaces to the
browser as `?error=unable_to_create_user` (documented in
`.claude/rules/auth.md:82-101`).

Today's workaround is a manual `convex run betaAllowlist/mutations:addAllowlistEntry`
call after the migration. Hit it on `improvements-cover-image-style/`
(deployment `dev:outstanding-dachshund-221`) on 2026-05-07 — Google OAuth
completed, account creation failed, fixed by manually allowlisting
`hpark0011@gmail.com`. Every fresh worktree will hit this.

## Goal

After running the worktree migration block end-to-end, the worktree owner can
sign in with Google immediately, without any extra manual step or knowledge of
the allowlist mechanism.

## Scope

- Modify `scripts/sync-worktree-convex-secrets.sh` to read `git config user.email`
  and call `convex run betaAllowlist/mutations:addAllowlistEntry` against this
  worktree's deployment.
- Update `.claude/rules/worktrees.md` so the migration block reflects the new
  automatic behavior (and removes any stale "you may also need to add yourself
  to the allowlist" hint if present).
- Mirror any user-facing behavioral change into `.agents/skills/new-worktree/SKILL.md`
  if that path documents the migration steps (per the "Mirror scripts in
  lockstep" rule in `.claude/rules/worktrees.md`).

## Out of Scope

- Production allowlist management. This change must not run during deploy or
  affect production's allowlist.
- A larger "seed parity with main" effort (copying main's full data — articles,
  posts, conversations beyond Rick Rubin) into the worktree. Separate ticket.
- Adding additional emails (collaborators, test accounts) to the worktree
  allowlist. The migration owner is the worktree owner, full stop.
- Modifying `seedRickRubinDemo` itself. The seed remains a pure data fixture;
  worktree-owner identity is a script-layer concern.

## Approach

**Recommended: extend `sync-worktree-convex-secrets.sh` (Approach 3 from the
brief).** The script already runs once per migration, has shell access to read
`git config user.email`, runs against this worktree's deployment, and is
idempotent because `addAllowlistEntry` no-ops on duplicate (mutations.ts:8-29).

Rejected:
- **Approach 1 — extend `seedRickRubinDemo`.** The seed is an
  `internalMutation` and has no direct way to learn the worktree owner's email.
  Passing it as an arg pushes the responsibility back to the caller (the
  migration step), and a Convex env var (`WORKTREE_OWNER_EMAIL`) is one more
  thing to set up. Pollutes the demo seed's responsibilities.
- **Approach 2 — sibling seed (`seedWorktreeOwner`).** Same arg-passing
  problem as Approach 1, plus an extra step in the migration block users have
  to remember to run.

Sketch (final wording can vary):

```bash
# at the end of sync-worktree-convex-secrets.sh, after the existing
# SITE_URL / AUTH_ALLOWED_HOSTS block

OWNER_EMAIL=$(git config user.email || true)
if [[ -z "$OWNER_EMAIL" ]]; then
  echo "Error: git config user.email is empty; cannot auto-allowlist worktree owner." >&2
  exit 1
fi

echo ""
echo "Allowlisting worktree owner for first Google sign-in:"
echo "  email=$OWNER_EMAIL"
(cd "$GIT_ROOT/packages/convex" \
  && pnpm exec convex run betaAllowlist/mutations:addAllowlistEntry \
       "{\"email\":\"$OWNER_EMAIL\",\"note\":\"worktree owner (auto)\"}" \
       >/dev/null)
```

- **Effort:** Small
- **Risk:** Low — the mutation is already idempotent; the script already
  runs only against this worktree's deployment (the script aborts earlier if
  `THIS_DEP == MAIN_DEP`, so prod can never be touched).

## Implementation Steps

1. Read `scripts/sync-worktree-convex-secrets.sh` end-to-end to find the
   correct insertion point (after the `SITE_URL` / `AUTH_ALLOWED_HOSTS` block,
   before the final summary `echo`).
2. Add the `git config user.email` read with explicit empty-check + abort.
3. Add the `convex run betaAllowlist/mutations:addAllowlistEntry` invocation
   with `--note "worktree owner (auto)"`. Quote the JSON arg to survive
   email addresses containing `+` or other characters.
4. Update the trailing `Synced N env vars …` summary to also report the
   allowlisted email.
5. Update `.claude/rules/worktrees.md` migration block: in the per-worktree
   provisioning workflow, after `sync-worktree-convex-secrets.sh`, mention
   that the script also allowlists `git config user.email` automatically.
   Remove any stale "you may need to add yourself to the allowlist" guidance.
6. Apply the matching update to `.agents/skills/new-worktree/SKILL.md` if it
   documents the migration steps (per worktrees.md "Mirror scripts in
   lockstep" rule).
7. Verify by running the migration end-to-end on a throwaway worktree:
   provision a new dev deployment, run the updated script, sign in with
   Google, confirm no `unable_to_create_user`.
8. Verify idempotency: run the script a second time, confirm exit 0 and a
   single allowlist row for the email.

## Constraints

- The new code path must NOT run during `npx convex deploy` or any other
  production-touching invocation. Keep it inside
  `sync-worktree-convex-secrets.sh`, which already enforces "this worktree's
  deployment is not main's" via the `MAIN_DEP == THIS_DEP` guard at lines
  43–48.
- The CLI invocation must use `convex run` (which routes via
  `packages/convex/.env.local`'s `CONVEX_DEPLOYMENT`), not `convex deploy`
  or anything that could read `CONVEX_DEPLOY_KEY`. See `.claude/rules/auth.md:123-131`.
- Empty `git config user.email` MUST abort with a non-zero exit and a clear
  message — silent skip would re-introduce the original footgun for users
  who have an unconfigured global git.
- Lowercasing the email is already handled inside `addAllowlistEntry`. Do
  not pre-lowercase in the script (it would mask any future divergence in
  the mutation's normalization).

## Resources

- `.claude/rules/worktrees.md` — per-worktree dev Convex deployment block
- `.claude/rules/auth.md:82-101` — beta allowlist footgun documentation
- `packages/convex/convex/betaAllowlist/mutations.ts:8-29` — idempotent
  `addAllowlistEntry` implementation
- `scripts/sync-worktree-convex-secrets.sh` — the file to modify
- Live example: worktree `improvements-cover-image-style/` on
  deployment `dev:outstanding-dachshund-221` hit and resolved this on
  2026-05-07
