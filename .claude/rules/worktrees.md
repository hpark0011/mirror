# Worktree Discipline

Rules for operating safely inside `.worktrees/<branch>/`.

## Canonical `.env.local` set is symlinked across worktrees

Two `.env.local` files are gitignored and live only in the main checkout. Every new worktree symlinks them in via `new-worktree.sh`:

| File | How it gets seeded in main |
|------|----------------------------|
| `apps/mirror/.env.local` | manual — copy from `apps/mirror/.env.local.example` and fill values |
| `packages/convex/.env.local` | `pnpm --filter=@feel-good/convex dev` once in main — the Convex CLI auto-writes it on first connect |

Resulting symlink layout in each worktree:

```
.worktrees/<branch>/apps/mirror/.env.local
  -> /Users/disquiet/Desktop/mirror/apps/mirror/.env.local
.worktrees/<branch>/packages/convex/.env.local
  -> /Users/disquiet/Desktop/mirror/packages/convex/.env.local
```

This shares dev coordinates across worktrees but makes each file a single global resource. **Any tool that writes to either file from any worktree mutates the canonical file for every worktree.**

`new-worktree.sh` enforces the canonical set: it refuses to create a worktree if either file is missing in main, with a per-file seed hint. If you ever see `convex dev` prompt "What would you like to configure?" or Next.js complain about a missing `NEXT_PUBLIC_CONVEX_URL` in a fresh worktree, that means a canonical file was deleted in main — fix it there, not in the worktree.

Before running a tool that may touch `.env.local`:

```bash
ls -la apps/mirror/.env.local packages/convex/.env.local
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
