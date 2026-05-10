# Worktree Discipline

Rules for operating safely inside `.worktrees/<branch>/`.

## Per-worktree dev Convex deployment (mandatory)

Each worktree provisions its **own** dev Convex deployment. Deployments are NOT shared with main or with sibling worktrees.

### Why

Shared dev deployment + diverging schemas = a guaranteed `convex dev` push failure across sibling branches.

If branch A adds an optional field to a table and writes a row, branch B (whose schema doesn't list the field) refuses to push because the existing row contains a field B's validator rejects. Convex has no "tolerate unknown fields" mode — the only escape hatches are deleting the offending row, narrowing it to match B, or merging A's schema into B. None of that scales when many worktrees may be doing schema-touching work in parallel.

The previous symlink model (shared `packages/convex/.env.local` across worktrees) made this collision automatic. Per-worktree deployments make it impossible.

### What's seeded vs what gets provisioned

| File                         | How the worktree gets it                                                                                                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/mirror/.env.local`     | **copied** from main by `new-worktree.sh` (independent file — Sentry/Tavus/Anthropic/Better-Auth secrets propagate; the three Convex coord lines get rewritten by `sync-worktree-convex-env.sh`) |
| `packages/convex/.env.local` | **provisioned per worktree, automatically** — `provision-worktree-convex.sh` runs `convex deployment create dev/<ns>/<branch> --type dev --select`, which creates a new dev deployment under the existing `mirror` project and writes this file. No new Convex project is created. |

### Workflow for a fresh worktree

```bash
bash .claude/skills/new-worktree/scripts/new-worktree.sh <branch-name>
# new-worktree.sh runs end-to-end:
#   1. git worktree add .worktrees/<branch-name>
#   2. pnpm install
#   3. cp apps/mirror/.env.local from main
#   4. ./scripts/provision-worktree-convex.sh
#        - convex deployment create dev/<ns>/<branch> --type dev --select
#        - convex dev --once --run seed:seedRickRubinDemo (push code + seed)
#   5. ./scripts/finalize-worktree.sh
#        - sync-worktree-convex-env.sh: rewrite CONVEX_* in apps/mirror/.env.local
#        - sync-worktree-convex-secrets.sh: copy BETTER_AUTH_SECRET, GOOGLE_*,
#          OAUTH_PROXY_*, ANTHROPIC_API_KEY etc. from main; set SITE_URL +
#          AUTH_ALLOWED_HOSTS for this worktree's port; allowlist
#          `git config user.email` for first Google sign-in.
# Idempotent end-to-end. Safe to re-run if any step fails partway.

cd .worktrees/<branch-name>
pnpm dev:safe
```

After that, `pnpm dev:safe` and `pnpm --filter=@feel-good/convex dev` both target this worktree's deployment. Schema changes here can't break any sibling branch's `convex dev`.

### Why `convex deployment create` and not `convex dev` interactive?

Per [Convex multi-deployment docs](https://docs.convex.dev/production/multiple-deployments), the canonical pattern for parallel feature-branch development is creating a separate **dev deployment under the same project** for each branch, named `dev/<namespace>/<branch>`. This is what `provision-worktree-convex.sh` does. Trade-offs of the alternatives we rejected:

- **Plain `convex dev` interactive prompt** (the previous flow): forces the user through 4 questions per worktree. Marginally automatable; never fully scriptable.
- **`convex dev --configure new` with a fresh project per worktree**: non-interactive but creates a new Convex project for every branch — pollutes the dashboard forever, no documented cleanup path.
- **Preview deployments (`--preview-create`)**: 5-day TTL on free / 14-day on paid, every schema change wipes data, no `convex dev` file-watch. Designed for CI previews, not local dev iteration.
- **Local mode (`--dev-deployment local`)**: in beta; no public URL means inbound webhooks (Stripe, Twilio) require ngrok; vector search and `ctx.storage` parity are undocumented. Worth revisiting once GA.

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

### Migrating an existing worktree to the per-project-deployment model

Worktrees provisioned before this rule applied may either (a) symlink `apps/mirror/.env.local` to main's, or (b) point at a separate Convex *project* (created via the old interactive `convex dev` prompt) rather than a `dev/<ns>/<branch>` deployment under the shared `mirror` project. To migrate:

```bash
cd .worktrees/<branch-name>
rm apps/mirror/.env.local             # removes the symlink, NOT main's file
rm packages/convex/.env.local         # discards the old deployment pointer
cp ../../apps/mirror/.env.local apps/mirror/.env.local
./scripts/provision-worktree-convex.sh   # new dev deployment under mirror
./scripts/finalize-worktree.sh           # env-sync + secret-sync
```

Verify with `ls -la apps/mirror/.env.local packages/convex/.env.local` — both should show `-rw-` (regular file), not `lrwxr` (symlink). The old per-worktree Convex *project* in the dashboard can be deleted manually; new deployments now live under the canonical `mirror` project.

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
