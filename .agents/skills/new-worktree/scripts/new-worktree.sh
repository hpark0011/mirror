#!/bin/bash
# Create a new git worktree for parallel development.
#
# Lockstep mirror of .claude/skills/new-worktree/scripts/new-worktree.sh —
# any change here must also be made there. See .claude/rules/worktrees.md
# for why this script copies (not symlinks) apps/mirror/.env.local and
# does NOT seed packages/convex/.env.local.

set -e

BRANCH_NAME="$1"
[[ -z "$BRANCH_NAME" ]] && echo "Error: branch name required" && exit 1

GIT_ROOT=$(git rev-parse --show-toplevel)
WORKTREE_PATH="$GIT_ROOT/.worktrees/$BRANCH_NAME"

[[ -d "$WORKTREE_PATH" ]] && echo "Error: worktree already exists at $WORKTREE_PATH" && exit 1

# Verify apps/mirror/.env.local is present in main.
APP_ENV_REL="apps/mirror/.env.local"
APP_ENV_SRC="$GIT_ROOT/$APP_ENV_REL"
if [[ ! -f "$APP_ENV_SRC" ]]; then
  echo "Error: $APP_ENV_REL is missing from the main repo." >&2
  echo "  seed: copy from apps/mirror/.env.local.example and fill in values" >&2
  exit 1
fi

mkdir -p "$GIT_ROOT/.worktrees"
git worktree add -b "$BRANCH_NAME" "$WORKTREE_PATH" main

cd "$WORKTREE_PATH"
pnpm install

# Copy (not symlink) apps/mirror/.env.local. packages/convex/.env.local is
# intentionally NOT seeded — provisioned per-worktree in the next-step
# block below.
APP_ENV_DEST="$WORKTREE_PATH/$APP_ENV_REL"
mkdir -p "$(dirname "$APP_ENV_DEST")"
cp "$APP_ENV_SRC" "$APP_ENV_DEST"
echo ""
echo "Copied $APP_ENV_REL from main (independent file — edits here stay here)"

cat <<EOF

Worktree created: $WORKTREE_PATH

Next steps (one-time per worktree):
  1. cd "$WORKTREE_PATH"
  2. pnpm --filter=@feel-good/convex dev
       Choose "create a new project" when prompted. The CLI writes
       packages/convex/.env.local with this worktree's deployment coords.
  3. ./scripts/sync-worktree-convex-env.sh
       Rewrites the three CONVEX_* lines in apps/mirror/.env.local so
       Next.js targets this worktree's deployment.
  4. ./scripts/sync-worktree-convex-secrets.sh
       Copies BETTER_AUTH_SECRET, GOOGLE_*, ANTHROPIC_API_KEY, etc. from
       main's deployment into this worktree's deployment.
  5. pnpm --filter=@feel-good/convex exec convex run seed:seedRickRubinDemo
       Populates this deployment with the rick-rubin demo workspace
       (3 articles, 10 posts, 2 chat conversations). Browse at
       http://localhost:3001/@rick-rubin once \`pnpm dev:safe\` is up.

Why a per-worktree deployment? See .claude/rules/worktrees.md.

EOF
