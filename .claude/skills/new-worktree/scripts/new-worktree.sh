#!/bin/bash
# Create a new git worktree for parallel development.
#
# Usage: new-worktree.sh <branch-name>
#
# Steps:
#   1. Validate the branch-name argument.
#   2. Create a fresh worktree under .worktrees/<branch-name> branched off main.
#   3. Run the same local setup script Codex uses for new worktrees.

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

# Verify setup prerequisites before creating anything. The full setup runs again
# inside the new worktree after checkout.
bash "$GIT_ROOT/scripts/setup-codex-worktree.sh" --check

# Ensure the .worktrees/ container directory exists.
mkdir -p "$GIT_ROOT/.worktrees"

# Create a new branch from main and check it out into the worktree path.
# --quiet suppresses the per-percent "Updating files:" progress spam.
git worktree add --quiet -b "$BRANCH_NAME" "$WORKTREE_PATH" main

# --- 3. Run local setup ------------------------------------------------------

cd "$WORKTREE_PATH"
bash "$GIT_ROOT/scripts/setup-codex-worktree.sh"

echo ""
echo "Worktree created: $WORKTREE_PATH"
