# Git Worktree Best Practices

Rules for parallel feature development using git worktrees.

## Directory Structure

Use `.worktrees/` inside the repo root (already in `.gitignore`):

```
feel-good/
├── .worktrees/
│   ├── feature-auth/
│   └── fix-payment-bug/
├── apps/
└── packages/
```

## Creating Worktrees

```bash
# From existing branch
git worktree add .worktrees/feature-x feature-x

# New branch from main
git worktree add -b feature-y .worktrees/feature-y main
```

Use consistent prefixes: `feature-*`, `fix-*`, `refactor-*`.

## Core Rules

1. **One worktree = one dedicated branch off main.** Every worktree must be tied to its own branch created from main. Never share a branch across worktrees, and never point a worktree at main itself.
2. **Never parallelize overlapping files.** Two features touching the same files creates merge pain that negates speed gains. Pick orthogonal work.
3. **One agent per worktree.** Never let two agents share a working directory.
4. **Run `pnpm install` in each worktree.** Every worktree is a separate working directory — dependencies are not shared.
5. **Use different ports per worktree.** Dev servers will collide if multiple worktrees run the same app.
6. **Commit often.** Frequent commits within each worktree prevent lost work.

## Cleanup

- Remove merged worktrees: `git worktree remove .worktrees/feature-x`
- Prune stale metadata: `git worktree prune`
- Don't let finished worktrees accumulate.

## Agent Permissions in Worktrees

Allowed: commits, local branches, fetch/pull, push to remote.
Prohibited: force-push, deleting other worktrees, modifying other branches.
