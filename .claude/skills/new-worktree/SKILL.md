---
name: new-worktree
description: Create a new git worktree for parallel development. Supports three input modes — empty (scratch), ticket file, or free-text requirement. Invoke with `/workspace:new-worktree`, `/workspace:new-worktree <ticket-file.md>`, or `/workspace:new-worktree <requirement>`.
---

# New Worktree

Create a new git worktree for parallel feature development in this monorepo.

## Trigger

- `/workspace:new-worktree` — empty mode; ask the user for scope, then proceed
- `/workspace:new-worktree <path-to-ticket.md>` — derive name from a ticket file
- `/workspace:new-worktree <requirement>` — derive name from free-text

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
| Ends with `.md`           | Read the ticket. Prefix from `type` field: `fix` → `fix-`, `refactor` → `refactor-`, `chore`/`docs` → `chore-`, else `feature-`. Slugify the title (2–4 key words).                                                                  |
| Anything else (free-text) | Prefix by intent: bug/broken behavior → `fix-`, restructuring → `refactor-`, polish/iteration on an existing feature → `improvements-`, chore/docs → `chore-`, else `feature-`. If the input is already a valid slug, use it as-is.  |

Do not ask the user to confirm the generated name — proceed.

### 2. Run the creation script

```bash
bash .claude/skills/new-worktree/scripts/new-worktree.sh <branch-name>
```

The script bails on its own if the worktree path or branch already exists.

### 3. Report

Tell the user:

- Worktree path (`.worktrees/<branch-name>`)
- Branch name
- That `pnpm install` completed
- Reminder to use a different port if running dev servers in multiple worktrees
