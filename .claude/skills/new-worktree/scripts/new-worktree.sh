#!/bin/bash
# Create a new git worktree for parallel development.
#
# Usage: new-worktree.sh <branch-name>
#
# Steps:
#   1. Validate the branch-name argument.
#   2. Create a fresh worktree under .worktrees/<branch-name> branched off main.
#   3. Install dependencies with pnpm.
#   4. Symlink every .env.local from the main repo into the new worktree
#      (these files are gitignored, so worktrees don't get them automatically).

set -e  # Exit immediately on any failed command.

# --- 1. Validate input -------------------------------------------------------

BRANCH_NAME="$1"
[[ -z "$BRANCH_NAME" ]] && echo "Error: branch name required" && exit 1

# Resolve repo root so the script works no matter where it's invoked from.
GIT_ROOT=$(git rev-parse --show-toplevel)
WORKTREE_PATH="$GIT_ROOT/.worktrees/$BRANCH_NAME"

# Bail out if a worktree already lives at the target path — never overwrite.
[[ -d "$WORKTREE_PATH" ]] && echo "Error: worktree already exists at $WORKTREE_PATH" && exit 1

# --- 2. Create the worktree --------------------------------------------------

# Ensure the .worktrees/ container directory exists.
mkdir -p "$GIT_ROOT/.worktrees"

# Create a new branch from main and check it out into the worktree path.
git worktree add -b "$BRANCH_NAME" "$WORKTREE_PATH" main

# --- 3. Install dependencies -------------------------------------------------

cd "$WORKTREE_PATH"
pnpm install

# --- 4. Symlink .env.local files --------------------------------------------
# .env.local is gitignored, so the worktree starts without any local secrets.
# We symlink (not copy) so updates in the main checkout flow through automatically.

echo ""
echo "Symlinking .env.local files..."
ENV_COUNT=0
while IFS= read -r env_file; do
  # Compute the path relative to the repo root, then rebase it under the worktree.
  rel_path="${env_file#$GIT_ROOT/}"
  dest="$WORKTREE_PATH/$rel_path"

  # Make sure the parent directory exists before creating the symlink.
  mkdir -p "$(dirname "$dest")"
  ln -s "$env_file" "$dest"
  echo "  Linked $rel_path"
  ENV_COUNT=$((ENV_COUNT + 1))
done < <(find "$GIT_ROOT" -name '.env.local' -not -path '*/.worktrees/*' -not -path '*/node_modules/*')

if [[ $ENV_COUNT -eq 0 ]]; then
  echo "  No .env.local files found to symlink"
fi

echo ""
echo "Worktree created: $WORKTREE_PATH"
