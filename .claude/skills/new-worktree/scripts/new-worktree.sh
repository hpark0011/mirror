#!/bin/bash
set -e

BRANCH_NAME="$1"
[[ -z "$BRANCH_NAME" ]] && echo "Error: branch name required" && exit 1

GIT_ROOT=$(git rev-parse --show-toplevel)
WORKTREE_PATH="$GIT_ROOT/.worktrees/$BRANCH_NAME"

[[ -d "$WORKTREE_PATH" ]] && echo "Error: worktree already exists at $WORKTREE_PATH" && exit 1

mkdir -p "$GIT_ROOT/.worktrees"
git worktree add -b "$BRANCH_NAME" "$WORKTREE_PATH" main

cd "$WORKTREE_PATH"
pnpm install

# Symlink .env.local files (gitignored, so not included in worktree)
echo ""
echo "Symlinking .env.local files..."
ENV_COUNT=0
while IFS= read -r env_file; do
  rel_path="${env_file#$GIT_ROOT/}"
  dest="$WORKTREE_PATH/$rel_path"
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
