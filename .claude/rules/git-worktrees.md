# Git Worktree Best Practices

Rules for parallel feature development using git worktrees.

## Directory Structure

Use `.trees/` inside the repo root (already in `.gitignore`):

```
project/
├── .trees/
│   ├── feature-auth/
│   └── fix-payment-bug/
├── apps/
└── packages/
```

## Creating Worktrees

```bash
# From existing branch
git worktree add .trees/feature-x feature-x

# New branch from main
git worktree add -b feature-y .trees/feature-y main
```

Use consistent prefixes: `feature-*`, `fix-*`, `refactor-*`.

## Core Rules

1. **Never parallelize overlapping files.** Two features touching the same files creates merge pain that negates speed gains. Pick orthogonal work.
2. **One agent per worktree.** Never let two agents share a working directory.
3. **Run `pnpm install` in each worktree.** Every worktree is a separate working directory — dependencies are not shared.
4. **Use different ports per worktree.** Dev servers will collide if multiple worktrees run the same app.
5. **Commit often.** Frequent commits within each worktree prevent lost work.

## Cleanup

- Remove merged worktrees: `git worktree remove .trees/feature-x`
- Prune stale metadata: `git worktree prune`
- Don't let finished worktrees accumulate.

## Agent Permissions in Worktrees

Allowed: commits, local branches, fetch/pull, push to remote.
Prohibited: force-push, deleting other worktrees, modifying other branches.

## When NOT to Use Worktrees

- Quick context switches (minutes) — use `git stash`
- Features with heavy file overlap — work sequentially
- Expensive per-directory setup (large native builds)
