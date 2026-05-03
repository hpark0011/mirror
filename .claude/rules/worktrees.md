# Worktree Discipline

Rules for operating safely inside `.worktrees/<branch>/`.

## `apps/mirror/.env.local` is symlinked across worktrees

Every worktree's `apps/mirror/.env.local` is a symlink into the main repo:

```
.worktrees/<branch>/apps/mirror/.env.local
  -> /Users/disquiet/Desktop/mirror/apps/mirror/.env.local
```

This shares dev secrets across worktrees but makes the file a single global resource. **Any tool that writes to `apps/mirror/.env.local` from any worktree mutates the canonical file for every worktree.**

Before running a tool that may touch `.env.local`:

```bash
ls -la apps/mirror/.env.local
```

If output starts with `lrwxr` (symlink), treat the write as global.

## Vercel CLI footgun: `--yes` in an unlinked dir auto-pulls env

Running `vercel <anything> --yes` in a directory without `.vercel/project.json` performs three steps silently:

1. `vercel link` — creates `.vercel/`.
2. `vercel env pull` — overwrites `.env.local` with the linked environment's vars.
3. The original command (e.g. `ls`, `inspect`).

If `.env.local` is a symlink, step 2 follows it and clobbers the canonical file across all worktrees. The `development` Vercel env on this project contains only `VERCEL_OIDC_TOKEN`, so the result is "every secret you had locally is gone."

**Rules:**

- Never use `--yes` with `vercel ls`, `vercel inspect`, or any read-only command.
- For deploy logs, prefer `vercel inspect <deployment-url> --logs` after a one-time interactive `vercel link`.
- If you must run `vercel env pull`, write to a temp file (`vercel env pull --environment=<env> /tmp/foo.env`) and review before merging.

## Recovering a clobbered `.env.local`

```bash
./scripts/restore-env-local.sh
```

Pulls non-secret values from `packages/convex/.env.local` (Convex coords) and `vercel env pull --environment=production` (Sentry DSN, Tavus). Excludes `CONVEX_DEPLOY_KEY` (would route the convex CLI to prod — see `.claude/rules/auth.md`).

Convex-side secrets (`BETTER_AUTH_SECRET`, `GOOGLE_*`, `RESEND_API_KEY`, `ANTHROPIC_API_KEY`, `PLAYWRIGHT_TEST_SECRET`) live in Convex env, not `.env.local`. View with `pnpm --filter=@feel-good/convex exec convex env list`.

## Worktree path discipline (general)

Every Edit/Write inside a worktree must use the worktree's absolute path. Sub-agent reports that name a main-repo path (`/Users/disquiet/Desktop/mirror/...` instead of `/Users/disquiet/Desktop/mirror/.worktrees/<branch>/...`) are a trap — the file may be a symlink and the write may ripple.
