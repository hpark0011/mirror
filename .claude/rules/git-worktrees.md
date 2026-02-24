---
paths:
  - "**/.worktrees/**"
---

# Git Worktree Best Practices

Use `.worktrees/` inside the repo root (already in `.gitignore`).

## Creating Worktrees

```bash
git worktree add .worktrees/feature-x feature-x          # From existing branch
git worktree add -b feature-y .worktrees/feature-y main   # New branch from main
```

## Core Rules

1. **One worktree = one dedicated branch off main.** Never share a branch across worktrees or point a worktree at main.
2. **Never parallelize overlapping files.** Pick orthogonal work.
3. **One agent per worktree.**
4. **Run `pnpm install` in each worktree.** Dependencies are not shared.
5. **Use different ports per worktree.**
6. **Commit often.**

## Cleanup

```bash
git worktree remove .worktrees/feature-x
git worktree prune
```

## Agent Permissions

Allowed: commits, local branches, fetch/pull, push to remote.
Prohibited: force-push, deleting other worktrees, modifying other branches.
