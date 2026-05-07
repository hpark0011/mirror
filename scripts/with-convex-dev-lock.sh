#!/bin/bash
# Prevent two worktrees from pushing different Convex code to the same dev deployment.

set -euo pipefail

ROOT=$(git rev-parse --show-toplevel)
ROOT=$(cd "$ROOT" && pwd -P)
CONVEX_ENV="$ROOT/packages/convex/.env.local"

DEPLOYMENT="unknown"
if [[ -f "$CONVEX_ENV" ]]; then
  DEPLOYMENT=$(grep -E '^CONVEX_DEPLOYMENT=' "$CONVEX_ENV" | tail -1 | cut -d= -f2- | tr -d '"' || true)
fi

LOCK_KEY=$(printf "%s" "$DEPLOYMENT" | tr -c 'A-Za-z0-9._-' '_')
LOCK_DIR="${TMPDIR:-/tmp}/feel-good-convex-dev-${LOCK_KEY}.lock"
INFO_FILE="$LOCK_DIR/info"

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  if [[ -f "$INFO_FILE" ]]; then
    existing_pid=$(sed -n '1p' "$INFO_FILE")
    existing_root=$(sed -n '2p' "$INFO_FILE")
    if [[ -n "$existing_pid" ]] && kill -0 "$existing_pid" 2>/dev/null; then
      echo "Convex dev is already running for $DEPLOYMENT." >&2
      echo "Active worktree: $existing_root" >&2
      echo "Stop that process before starting Convex dev here: $ROOT" >&2
      exit 1
    fi
  fi

  rm -rf "$LOCK_DIR"
  mkdir "$LOCK_DIR"
fi

cleanup() {
  rm -rf "$LOCK_DIR"
}
trap cleanup EXIT INT TERM

printf "%s\n%s\n" "$$" "$ROOT" > "$INFO_FILE"

"$@"
