# Worktree Discipline

Rules for operating safely inside `.worktrees/<branch>/` and other git worktree roots.

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
| `packages/convex/.env.local` | **provisioned per worktree, automatically** — `provision-worktree-convex.sh` runs `convex deployment create dev/<ns>/<branch> --type dev --select --expiration "in 7 days"`, which creates an expiring empty dev deployment under the existing `mirror` project and writes this file. No new Convex project is created. Code push, seeding, and owner allowlist happen later in `finalize-worktree.sh`. Override the TTL with `CONVEX_WORKTREE_EXPIRATION`, e.g. `CONVEX_WORKTREE_EXPIRATION="in 2 days"`. |

### Workflow for a fresh worktree

```bash
bash .agents/skills/new-worktree/scripts/new-worktree.sh <branch-name>
# new-worktree.sh runs end-to-end:
#   1. git worktree add .worktrees/<branch-name>
#   2. pnpm install
#   3. cp apps/mirror/.env.local from main
#   4. ./scripts/provision-worktree-convex.sh
#        - convex deployment create dev/<ns>/<branch> --type dev --select --expiration "in 7 days"
#          (creates an EMPTY deployment — no env vars, no code, no data)
#   5. ./scripts/finalize-worktree.sh — four steps in dependency order:
#        a. sync-worktree-convex-env.sh — rewrite CONVEX_* in
#           apps/mirror/.env.local so Next targets this deployment.
#        b. sync-worktree-convex-secrets.sh — copy BETTER_AUTH_SECRET,
#           GOOGLE_*, OAUTH_PROXY_*, ANTHROPIC_API_KEY etc. from main;
#           set SITE_URL + AUTH_ALLOWED_HOSTS for this worktree's port.
#           Must precede (c): convex/env.ts validates SITE_URL + GOOGLE_*
#           at module load, so an unpopulated deployment can't accept a
#           code push.
#        c. convex dev --once --run seed:seedRickRubinDemo — push Convex
#           code AND seed the demo workspace. Push fails without (b);
#           seed fails without push.
#        d. allowlist-worktree-owner.sh — call betaAllowlist mutation
#           for `git config user.email`. Requires (c): the mutation only
#           exists once code is deployed.
# Idempotent end-to-end. Safe to re-run if any step fails partway —
# `finalize-worktree.sh` is the recovery entry point.

cd .worktrees/<branch-name>
pnpm dev:safe
```

After that, `pnpm dev:safe` and `pnpm --filter=@feel-good/convex dev` both target this worktree's deployment. Schema changes here can't break any sibling branch's `convex dev`.

The worktree helper scripts resolve the main checkout from `git worktree list`
or `MIRROR_CANONICAL_ROOT`, so recovery commands also work from external git
worktree roots such as Codex or Conductor paths. Codex cloud setup only installs
dependencies via `.codex/environments/environment.toml`; it does not provision a
local Convex deployment.

### Expiration and cleanup

Per-worktree dev deployments default to `--expiration "in 7 days"` so forgotten
branches do not consume Convex team deployment quota forever. Use a shorter TTL
for throwaway work with:

```bash
CONVEX_WORKTREE_EXPIRATION="in 2 days" \
  bash .agents/skills/new-worktree/scripts/new-worktree.sh chore-short-test
```

Use `CONVEX_WORKTREE_EXPIRATION=none` only for a long-lived branch that truly
needs persistent backend state.

### Optional: pre-populate your own profile

After running `pnpm dev:safe` and signing in with Google at the worktree's
app URL (the `users` row only exists once the auth flow has run), clone
Rick's fixtures under your own user so `/@<your-username>` has content to
browse and chat against:

```bash
pnpm --filter=@feel-good/convex exec convex run seed:seedWorktreeOwnerDemo \
  "{\"email\":\"$(git config user.email)\"}"
```

Idempotent. Throws a clear error if you haven't signed in yet (no `users`
row to target). Use this only for in-app browsing — it does NOT generate
embeddings, so the clone agent won't have RAG context against the cloned
content (matches Rick's seed). For a full snapshot of main's data
(reproducing a prod bug, etc.), use `convex export` / `convex import`
instead.

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
./scripts/provision-worktree-convex.sh   # new expiring empty dev deployment under mirror
./scripts/finalize-worktree.sh           # env-coords + secrets + push+seed + allowlist
```

Verify with `ls -la apps/mirror/.env.local packages/convex/.env.local` — both should show `-rw-` (regular file), not `lrwxr` (symlink). The `sync-worktree-*.sh` scripts (run by `finalize-worktree.sh`) refuse to write through a symlink.

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

### Google OAuth on worktree ports

Mirror worktrees run on a stable per-worktree localhost port allocated by
`scripts/with-worktree-port.mjs`. Google OAuth callback URLs are exact, so do
not register every generated localhost port in Google.

Better Auth is configured to support dynamic local hosts via Convex env:

- `SITE_URL` — this worktree's current app URL, e.g. `http://localhost:3350`
- `AUTH_ALLOWED_HOSTS` — should include `localhost:*` and `127.0.0.1:*`
- `OAUTH_PROXY_ENABLED` / `OAUTH_PROXY_PRODUCTION_URL` — optional, but needed
  when Google only has the stable production callback registered

`./scripts/sync-worktree-convex-secrets.sh` sets the first two automatically
after copying main's Convex env. If main has OAuth Proxy env vars configured,
they are copied too. If Google login still redirects to `localhost:3001`, rerun
the sync script from inside the worktree and verify:

```bash
pnpm --filter=@feel-good/convex exec convex env list
```

## Worktree path discipline (general)

Every Edit/Write inside a worktree must use the worktree's absolute path. Sub-agent reports that name a main-repo path (`/Users/disquiet/Desktop/mirror/...` instead of `/Users/disquiet/Desktop/mirror/.worktrees/<branch>/...`) target the wrong file when the same path exists in both places.

## Mirror scripts in lockstep

`new-worktree.sh` exists in two places:

- `.claude/skills/new-worktree/scripts/new-worktree.sh` (Claude Code)
- `.agents/skills/new-worktree/scripts/new-worktree.sh` (codex / other harnesses)

Any change to one MUST be applied to the other. The two scripts have different surface (logging verbosity, install flags) but the env-seeding logic must stay identical.

## Parallel dev servers and e2e ports

Mirror dev and Playwright e2e scripts allocate a stable per-worktree port via
`scripts/with-worktree-port.mjs`. Do not hardcode `localhost:3001` in new test
or dev scripts; read `MIRROR_PORT`, `PORT`, or Playwright's configured
`baseURL` instead. The main checkout still prefers `3001`, while worktrees use
the allocated range.

Do not add scripts that kill shared ports such as `3001` before starting dev.
That can stop another worktree's app or e2e run mid-test.

`convex dev` is guarded by `scripts/with-convex-dev-lock.sh`, which keys the
lock off the deployment slug in `packages/convex/.env.local`. With per-worktree
deployments each worktree has a unique slug, so the lock rarely fires — but it
still catches the case where a worktree hasn't been migrated and is still
pointing at a deployment a sibling is also using.
