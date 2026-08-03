#!/usr/bin/env bash
# Set up either a local Codex worktree or a standalone Codex cloud clone.
#
# Local secondary worktrees can inherit the canonical checkout's app env and
# receive their own Convex dev deployment. Standalone clones have no canonical
# checkout to inherit from, so they retain the dependency-only setup used by
# Codex cloud environments.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./worktree-lib.sh
source "$SCRIPT_DIR/worktree-lib.sh"

GIT_ROOT="$(worktree_git_root)"
MAIN_ROOT="$(worktree_find_main_root || true)"

if [[ -n "$MAIN_ROOT" && "$GIT_ROOT" != "$MAIN_ROOT" ]]; then
  echo "Detected local Codex worktree; running full worktree setup."
  exec "$SCRIPT_DIR/conductor-setup.sh"
fi

echo "Detected standalone checkout; installing dependencies only."
cd "$GIT_ROOT"
exec pnpm install --frozen-lockfile --prefer-offline --reporter=append-only
