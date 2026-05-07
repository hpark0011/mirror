---
name: new-worktree
description: Create a new git worktree for parallel development. Supports three input modes — empty (scratch), ticket file, or free-text requirement. Invoke with `/workspace:new-worktree`, `/workspace:new-worktree <ticket-file.md>`, or `/workspace:new-worktree <requirement>`.
---

# New Worktree

Create a new git worktree for parallel feature development in this monorepo.

## Trigger

- `/workspace:new-worktree` — start a scratch worktree, rename after scoping
- `/workspace:new-worktree <path-to-ticket.md>` — derive name from a ticket file
- `/workspace:new-worktree <requirement>` — derive name from a free-text description

## Input Detection

Determine the mode from the argument:

| Condition                | Mode                      |
| ------------------------ | ------------------------- |
| No argument provided     | **Empty (scratch)**       |
| Argument ends with `.md` | **Ticket file**           |
| Anything else            | **Free-text requirement** |

## Name Generation Rules

All branch names must follow these conventions:

- **Prefix**: `feature-`, `fix-`, `chore-`, `docs-`, `improvements-` or `refactor-`
- **Slug**: 2-4 words, kebab-case, lowercase
- **Max length**: 40 characters total
- **No special characters** beyond hyphens
- Examples: `feature-auth-magic-link`, `fix-nav-transition-bug`, `refactor-dock-layout`

## Mode 1: Empty (Scratch)

### Steps

1. Generate a temporary name: `scratch-<4-char-hex>` (e.g., `scratch-a3f1`). Use a random hex value.
2. Check the name doesn't collide with existing worktrees/branches (regenerate if it does).
3. Run the creation script:
   ```bash
   bash .agents/skills/new-worktree/scripts/new-worktree.sh scratch-<hex>
   ```
4. Report the temporary worktree is ready.
5. **Ask the user** what they want to work on in this worktree — the scope, feature, or bug.
6. Once the user responds, generate a proper branch name following the naming rules above.
7. Rename the worktree immediately (do not ask for confirmation):
   ```bash
   bash .agents/skills/new-worktree/scripts/rename-worktree.sh scratch-<hex> <new-name>
   ```
8. Report the final name and path.

## Mode 2: Ticket File

### Steps

1. **Read the ticket file** using the Read tool to extract its title, type, and description.
2. **Derive the prefix** from the `type` field:
   - Type is `fix` → `fix-`
   - Type is `refactor` → `refactor-`
   - Type is `chore` → `chore-`
   - Type is `docs` → `docs-`
   - Otherwise → `feature-`
3. **Slugify the title** into a branch name: lowercase, strip special characters, replace spaces with hyphens, truncate to 2-4 key words.
4. Proceed to **Shared Steps** below immediately (do not ask for confirmation on the name).

## Mode 3: Free-Text Requirement

### Steps

1. **Analyze the requirement** to determine the prefix:
   - Describes a bug or broken behavior → `fix-`
   - Describes restructuring existing code → `refactor-`
   - Otherwise → `feature-`
2. **Generate a concise slug** (2-4 words, kebab-case) that captures the essence of the requirement.
3. Proceed to **Shared Steps** below immediately (do not ask for confirmation on the name).

## Shared Steps (All Modes)

These run after a branch name is confirmed (Modes 2 & 3) or after initial creation (Mode 1):

### 1. Check worktree doesn't already exist

Run `git worktree list` and check if a worktree for this branch already exists. Also check if the branch name is already taken with `git branch --list <branch-name>`. If either exists, inform the user and stop.

### 2. Run the creation script

```bash
bash .agents/skills/new-worktree/scripts/new-worktree.sh <branch-name>
```

### 3. Report result and next steps

Tell the user:

- The worktree path (`.worktrees/<branch-name>`)
- The branch name created
- That `pnpm install` completed
- Remind them to use a different port if running dev servers in multiple worktrees
- **Provision the worktree's dev Convex deployment** (one-time per worktree):
  1. `cd .worktrees/<branch-name>`
  2. `pnpm --filter=@feel-good/convex dev` — choose "create a new project" when prompted
  3. `./scripts/sync-worktree-convex-env.sh` — points this worktree's frontend at the new deployment
  4. `./scripts/sync-worktree-convex-secrets.sh` — copies Convex env secrets from main
- Why this matters: see `.claude/rules/worktrees.md` § Per-worktree dev Convex deployment.
