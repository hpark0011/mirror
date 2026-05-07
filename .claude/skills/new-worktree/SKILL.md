---
name: new-worktree
description: Create a new git worktree for parallel development. Supports three input modes — empty (scratch), ticket file, or free-text requirement. Invoke with `/new-worktree`, `/new-worktree <ticket-file.md>`, or `/new-worktree <requirement>`.
---

# New Worktree

Create a new git worktree for parallel feature development in this monorepo.

## Trigger

- `/new-worktree` — empty mode; ask the user for scope, then proceed
- `/new-worktree <path-to-ticket.md>` — derive name from a ticket file
- `/new-worktree <requirement>` — derive name from free-text

## Branch Name Rules

- Prefix: `feature-`, `fix-`, `chore-`, `docs-`, `improvements-`, or `refactor-`
- Slug: 2–4 words, kebab-case, lowercase
- Max 40 chars total; no special characters beyond hyphens
- Examples: `feature-auth-magic-link`, `fix-nav-transition-bug`, `refactor-dock-layout`

## Steps

### 1. Determine prefix + slug

| Argument                  | How to derive                                                                                                                                                                                                                       |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| None                      | Ask the user for scope, then treat the response as free-text below.                                                                                                                                                                  |
| Ends with `.md`           | Read the ticket. Prefix from `type` field: `fix` → `fix-`, `refactor` → `refactor-`, `docs` → `docs-`, `chore` → `chore-`, else `feature-`. Slugify the title (2–4 key words).                                                       |
| Anything else (free-text) | Prefix by intent: bug/broken behavior → `fix-`, restructuring → `refactor-`, polish/iteration on an existing feature → `improvements-`, docs → `docs-`, chore → `chore-`, else `feature-`. If the input is already a valid slug, use it as-is. |

Do not ask the user to confirm the generated name — proceed.

### 2. Run the creation script

```bash
bash .claude/skills/new-worktree/scripts/new-worktree.sh <branch-name>
```

The script bails on its own if the worktree path or branch already exists.

### 3. Report and tell the user the next steps

Tell the user:

- Worktree path (`.worktrees/<branch-name>`)
- Branch name
- That `pnpm install` completed
- Reminder to use a different port if running dev servers in multiple worktrees
- **Provision the worktree's dev Convex deployment** (one-time per worktree):
  1. `cd .worktrees/<branch-name>`
  2. `pnpm --filter=@feel-good/convex dev` — choose "create a new project" when prompted
  3. `./scripts/sync-worktree-convex-env.sh` — points this worktree's frontend at the new deployment
  4. `./scripts/sync-worktree-convex-secrets.sh` — copies Convex env secrets from main
- Why this matters: see `.claude/rules/worktrees.md` § Per-worktree dev Convex deployment.
