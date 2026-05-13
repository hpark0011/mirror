---
paths:
  - "scripts/*worktree*"
  - "scripts/worktree-lib.sh"
  - "scripts/restore-env-local.sh"
  - "scripts/with-worktree-port.mjs"
  - "scripts/with-convex-dev-lock.sh"
  - "scripts/ensure-local-auth-url.mjs"
  - ".claude/skills/new-worktree/**"
  - ".agents/skills/new-worktree/**"
  - ".codex/environments/**"
  - "apps/mirror/.env.local"
  - "packages/convex/.env.local"
---

# Worktree Discipline

Rules for operating safely inside `.worktrees/<branch>/` and other git worktree roots.

## Fresh Worktree

Use the script; do not hand-roll env/deployment setup.

```bash
bash .claude/skills/new-worktree/scripts/new-worktree.sh <branch-name>
cd .worktrees/<branch-name>
pnpm dev:safe
```

The script creates the worktree, installs deps, copies `apps/mirror/.env.local`
as a regular file, provisions an expiring Convex dev deployment, syncs env
vars/secrets, pushes Convex code, seeds demo data, and allowlists
`git config user.email`.

If setup fails after provisioning, rerun `./scripts/finalize-worktree.sh` from
inside the worktree. If `packages/convex/.env.local` is missing, run
`./scripts/provision-worktree-convex.sh` first.

The worktree helper scripts resolve the main checkout from Git's common
directory or `MIRROR_CANONICAL_ROOT`, so recovery commands also work from
external git worktree roots such as Codex or Conductor paths, even when the main
checkout is currently on a feature branch. Codex cloud setup only installs
dependencies via `.codex/environments/environment.toml`; it does not provision a
local Convex deployment.

## Convex Deployment Model

Local worktrees use Convex **dev** deployments. Preview deployments are for CI
previews and have different TTL/data semantics, so do not use them for local
worktree setup.

`provision-worktree-convex.sh` constructs
`team:project:dev/<namespace>/<branch>` and calls:

```bash
convex deployment create "$DEPLOYMENT_REF" --type dev --select --expiration "$EXPIRATION"
```

Default expiration is `in 2 days`; shorten it for throwaway work:

```bash
CONVEX_WORKTREE_EXPIRATION="in 12 hours" \
  bash .claude/skills/new-worktree/scripts/new-worktree.sh chore-short-test
```

Use `CONVEX_WORKTREE_EXPIRATION=none` only for a long-lived branch that truly
needs persistent backend state.

## Optional Profile Seed

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

## Existing Worktrees

```bash
cd .worktrees/<branch-name>
rm apps/mirror/.env.local             # removes the symlink, NOT main's file
rm packages/convex/.env.local         # removes the old deployment pointer
cp ../../apps/mirror/.env.local apps/mirror/.env.local
./scripts/provision-worktree-convex.sh
./scripts/finalize-worktree.sh           # env-coords + secrets + push+seed + allowlist
```

Verify with `ls -la apps/mirror/.env.local packages/convex/.env.local` — both
should show `-rw-` (regular file), not `lrwxr` (symlink).

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
`scripts/with-worktree-port.mjs`. Google OAuth callback URLs are exact —
**we never register per-worktree localhost ports in Google Cloud Console.**
Instead, every dev/preview host bounces through production via the Better
Auth OAuth Proxy plugin
([docs](https://www.better-auth.com/docs/plugins/oauth-proxy)).

The single registered redirect URI in Google Console is:

```
https://greymirror.ai/api/auth/callback/google
```

The bounce flow: dev (`localhost:3350`) initiates OAuth using prod's
redirect URI → Google → `greymirror.ai` (the bounce hub) → encrypted
payload back to dev's `currentURL` → dev decrypts and creates a session.

Required Convex env (set on **every** deployment — prod, main dev, every
worktree dev):

| Var | Prod value | Worktree dev value |
|-----|------------|---------------------|
| `SITE_URL` | `https://greymirror.ai` | this worktree's URL, e.g. `http://localhost:3350` |
| `AUTH_ALLOWED_HOSTS` | (omit) | `localhost:*,127.0.0.1:*` |
| `OAUTH_PROXY_ENABLED` | `true` | `true` |
| `OAUTH_PROXY_PRODUCTION_URL` | `https://greymirror.ai` | `https://greymirror.ai` |
| `OAUTH_PROXY_SECRET` | shared 32-byte base64 | identical shared value |

**Why `OAUTH_PROXY_SECRET` must match across deployments:** the proxy
encrypts the user payload on prod and decrypts it on dev. If the secret
diverges, dev rejects the bounced payload with a decryption error.
Setting `OAUTH_PROXY_SECRET` explicitly decouples this from
`BETTER_AUTH_SECRET`, which can rotate independently per deployment.

`./scripts/sync-worktree-convex-secrets.sh` copies all five vars from
main's deployment, then overrides `SITE_URL` with the worktree's port and
appends `localhost:*,127.0.0.1:*` to `AUTH_ALLOWED_HOSTS`. If Google login
still redirects to the wrong host or fails after the bounce, rerun the
sync script and verify:

```bash
pnpm --filter=@feel-good/convex exec convex env list | grep -E '(OAUTH_PROXY|SITE_URL|AUTH_ALLOWED_HOSTS)'
```

`pnpm dev:safe` also runs `scripts/ensure-local-auth-url.mjs` before starting
the servers. That preflight keeps Convex `SITE_URL` aligned with the current
Mirror worktree port so the OAuth proxy callback does not bounce back to a
stale localhost port.

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
