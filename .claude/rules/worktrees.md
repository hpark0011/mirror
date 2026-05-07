# Worktree Discipline

Rules for operating safely inside `.worktrees/<branch>/`.

## Per-worktree dev Convex deployment (mandatory)

Each worktree provisions its **own** dev Convex deployment. Deployments are NOT shared with main or with sibling worktrees.

### Why

Shared dev deployment + diverging schemas = a guaranteed `convex dev` push failure across sibling branches.

If branch A adds an optional field to a table and writes a row, branch B (whose schema doesn't list the field) refuses to push because the existing row contains a field B's validator rejects. Convex has no "tolerate unknown fields" mode — the only escape hatches are deleting the offending row, narrowing it to match B, or merging A's schema into B. None of that scales when many worktrees may be doing schema-touching work in parallel.

The previous symlink model (shared `packages/convex/.env.local` across worktrees) made this collision automatic. Per-worktree deployments make it impossible.

### What's seeded vs what you provision

| File | How the worktree gets it |
|------|--------------------------|
| `apps/mirror/.env.local` | **copied** from main by `new-worktree.sh` (independent file — Sentry/Tavus/Anthropic/Better-Auth secrets propagate; the three Convex coord lines get rewritten by `sync-worktree-convex-env.sh`) |
| `packages/convex/.env.local` | **provisioned per worktree** — Convex CLI writes it on first `pnpm --filter=@feel-good/convex dev` run |

### Workflow for a fresh worktree

```bash
bash .claude/skills/new-worktree/scripts/new-worktree.sh <branch-name>
cd .worktrees/<branch-name>
pnpm --filter=@feel-good/convex dev
  # When prompted, choose "create a new project". The CLI writes
  # packages/convex/.env.local for this branch.
./scripts/sync-worktree-convex-env.sh
  # Rewrites the three CONVEX_* lines in apps/mirror/.env.local to
  # point at this worktree's deployment.
./scripts/sync-worktree-convex-secrets.sh
  # Copies BETTER_AUTH_SECRET, GOOGLE_*, ANTHROPIC_API_KEY, etc. from
  # main's deployment into this worktree's deployment.
pnpm --filter=@feel-good/convex exec convex run seed:seedRickRubinDemo
  # Populates the deployment with the rick-rubin demo workspace
  # (3 articles, 10 posts, 2 chat conversations). The seed is the
  # canonical way to populate a fresh deployment — it's schema-safe by
  # construction and idempotent. Browse at
  # http://localhost:3001/@rick-rubin once `pnpm dev:safe` is up.
```

After that, `pnpm dev:safe` and `pnpm --filter=@feel-good/convex dev` both target this worktree's deployment. Schema changes here can't break any sibling branch's `convex dev`.

### Why code-based seeding instead of `convex export` / `import`?

The Convex Stack article on [seeding preview deployments](https://stack.convex.dev/seeding-data-for-preview-deployments) recommends code-based seeding (`convex/seed.ts`) over data import for cross-deployment workflows. For our case the trade-offs come out clearly in favor of seeding:

- Doesn't depend on main's data state — sibling branches' schema-divergent rows can't poison the seed.
- Schema-safe by construction — the seed runs through the current branch's validators.
- Idempotent — re-running adds nothing if data exists.
- Reviewable in PRs — the seed lives in source, not in a binary zip.

`convex export` / `convex import` is still the right tool when you specifically need to replicate a real user-by-user snapshot (e.g., reproducing a production bug locally). For everyday "make this worktree browseable for dev work," use the seed.

### Migrating an existing symlinked worktree

```bash
cd .worktrees/<branch-name>
rm apps/mirror/.env.local             # removes the symlink, NOT main's file
rm packages/convex/.env.local         # ditto
cp ../../apps/mirror/.env.local apps/mirror/.env.local
pnpm --filter=@feel-good/convex dev   # choose "create a new project"
./scripts/sync-worktree-convex-env.sh
./scripts/sync-worktree-convex-secrets.sh
pnpm --filter=@feel-good/convex exec convex run seed:seedRickRubinDemo
```

Verify with `ls -la apps/mirror/.env.local packages/convex/.env.local` — both should show `-rw-` (regular file), not `lrwxr` (symlink). The two `sync-worktree-*.sh` scripts will refuse to run if either file is still a symlink.

## Vercel CLI footgun: `--yes` in an unlinked dir auto-pulls env

Running `vercel <anything> --yes` in a directory without `.vercel/project.json` performs three steps silently:

1. `vercel link` — creates `.vercel/`.
2. `vercel env pull` — overwrites `.env.local` with the linked environment's vars.
3. The original command (e.g. `ls`, `inspect`).

With per-worktree env files this only clobbers **this worktree's** `apps/mirror/.env.local` — the blast radius no longer crosses worktrees. But the `development` Vercel env on this project contains only `VERCEL_OIDC_TOKEN`, so the result is still "every secret you had in this worktree is gone."

**Rules:**

- Never use `--yes` with `vercel ls`, `vercel inspect`, or any read-only command.
- For deploy logs, prefer `vercel inspect <deployment-url> --logs` after a one-time interactive `vercel link`.
- If you must run `vercel env pull`, write to a temp file (`vercel env pull --environment=<env> /tmp/foo.env`) and review before merging.

## Recovering a clobbered `.env.local`

```bash
./scripts/restore-env-local.sh
```

Pulls non-secret values from `packages/convex/.env.local` (Convex coords) and `vercel env pull --environment=production` (Sentry DSN, Tavus). Excludes `CONVEX_DEPLOY_KEY` (would route the convex CLI to prod — see `.claude/rules/auth.md`).

Convex-side secrets (`BETTER_AUTH_SECRET`, `GOOGLE_*`, `RESEND_API_KEY`, `ANTHROPIC_API_KEY`, `PLAYWRIGHT_TEST_SECRET`) live in Convex env, not `.env.local`. **Each worktree's deployment has its own Convex env** — view from inside the worktree:

```bash
pnpm --filter=@feel-good/convex exec convex env list
```

To re-pull from main's deployment, run `./scripts/sync-worktree-convex-secrets.sh`.

## Worktree path discipline (general)

Every Edit/Write inside a worktree must use the worktree's absolute path. Sub-agent reports that name a main-repo path (`/Users/disquiet/Desktop/mirror/...` instead of `/Users/disquiet/Desktop/mirror/.worktrees/<branch>/...`) target the wrong file when the same path exists in both places.

## Mirror scripts in lockstep

`new-worktree.sh` exists in two places:

- `.claude/skills/new-worktree/scripts/new-worktree.sh` (Claude Code)
- `.agents/skills/new-worktree/scripts/new-worktree.sh` (codex / other harnesses)

Any change to one MUST be applied to the other. The two scripts have different surface (logging verbosity, install flags) but the env-seeding logic must stay identical.
