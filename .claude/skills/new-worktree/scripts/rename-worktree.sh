#!/bin/bash
set -e

OLD_NAME="$1"
NEW_NAME="$2"
[[ -z "$OLD_NAME" || -z "$NEW_NAME" ]] && echo "Error: usage: rename-worktree.sh <old-name> <new-name>" && exit 1

GIT_ROOT=$(git rev-parse --show-toplevel)
OLD_PATH="$GIT_ROOT/.worktrees/$OLD_NAME"
NEW_PATH="$GIT_ROOT/.worktrees/$NEW_NAME"

[[ ! -d "$OLD_PATH" ]] && echo "Error: worktree not found at $OLD_PATH" && exit 1
[[ -d "$NEW_PATH" ]] && echo "Error: worktree already exists at $NEW_PATH" && exit 1

git branch -m "$OLD_NAME" "$NEW_NAME"
mv "$OLD_PATH" "$NEW_PATH"
git worktree repair

echo "Renamed: $OLD_NAME → $NEW_NAME"
echo "Worktree path: $NEW_PATH"
