#!/bin/bash
# Sync Convex env secrets from main's dev deployment into the current
# worktree's deployment.
#
# Convex env (BETTER_AUTH_SECRET, GOOGLE_CLIENT_*, ANTHROPIC_API_KEY,
# RESEND_API_KEY, PLAYWRIGHT_TEST_SECRET, etc.) is per-deployment. After
# `pnpm --filter=@feel-good/convex dev` provisions a fresh deployment for
# this worktree, those secrets are missing — server functions that need
# them throw at runtime. This script reads them from main's deployment
# and writes them to this worktree's deployment.
#
# Idempotent: re-running overwrites with the latest values from main.
#
# Implementation note: Convex CLI v1.33+ supports round-tripping
# `convex env list` output into `convex env set` stdin. Keep that path
# intact so multi-line values survive.

set -e

GIT_ROOT=$(git rev-parse --show-toplevel)

# Find main's checkout (one level up from .worktrees/<branch>/).
if [[ "$GIT_ROOT" == */.worktrees/* ]]; then
  MAIN_ROOT="${GIT_ROOT%/.worktrees/*}"
else
  echo "Error: this script must be run from a worktree, not main." >&2
  exit 1
fi

MAIN_CONVEX_ENV="$MAIN_ROOT/packages/convex/.env.local"
THIS_CONVEX_ENV="$GIT_ROOT/packages/convex/.env.local"

[[ -f "$MAIN_CONVEX_ENV" ]] || { echo "Error: $MAIN_CONVEX_ENV not found." >&2; exit 1; }
[[ -f "$THIS_CONVEX_ENV" ]] || { echo "Error: $THIS_CONVEX_ENV not found. Run \`pnpm --filter=@feel-good/convex dev\` first." >&2; exit 1; }

# The two deployments MUST be different. Otherwise the script would echo
# main's env back into itself — and on a misconfigured worktree where
# packages/convex/.env.local is still a symlink to main's, that's an
# infinite loop on a single deployment.
MAIN_DEP=$(grep '^CONVEX_DEPLOYMENT=' "$MAIN_CONVEX_ENV" | head -n1 | cut -d= -f2- | awk '{print $1}')
THIS_DEP=$(grep '^CONVEX_DEPLOYMENT=' "$THIS_CONVEX_ENV" | head -n1 | cut -d= -f2- | awk '{print $1}')

if [[ "$MAIN_DEP" == "$THIS_DEP" ]]; then
  echo "Error: this worktree's CONVEX_DEPLOYMENT ($THIS_DEP) is identical to main's." >&2
  echo "       That means the deployment is shared — sync would write main's secrets to itself." >&2
  echo "       Provision a fresh deployment with \`pnpm --filter=@feel-good/convex dev\` first." >&2
  exit 1
fi

echo "Source deployment (main): $MAIN_DEP"
echo "Target deployment (this): $THIS_DEP"
echo ""

# Pull all env vars from main in the CLI's round-trippable format.
TMPFILE=$(mktemp)
ERRFILE=$(mktemp)
trap 'rm -f "$TMPFILE" "$ERRFILE"' EXIT

if ! (cd "$MAIN_ROOT/packages/convex" && pnpm exec convex env list) > "$TMPFILE" 2> "$ERRFILE"; then
  echo "Error: \`convex env list\` failed. Is main's deployment reachable?" >&2
  if [[ -s "$ERRFILE" ]]; then
    cat "$ERRFILE" >&2
  fi
  exit 1
fi

if [[ ! -s "$TMPFILE" ]]; then
  echo "Error: \`convex env list\` returned no output. Is main's deployment reachable?" >&2
  if [[ -s "$ERRFILE" ]]; then
    cat "$ERRFILE" >&2
  fi
  exit 1
fi

COUNT=$(grep -c '^[A-Z_][A-Z0-9_]*=' "$TMPFILE" || true)

if ! (cd "$GIT_ROOT/packages/convex" && pnpm exec convex env set --force < "$TMPFILE"); then
  echo "Error: failed to sync env vars into this worktree's deployment." >&2
  exit 1
fi

MIRROR_PORT=$(node "$GIT_ROOT/scripts/with-worktree-port.mjs" mirror --print)
WORKTREE_SITE_URL="http://localhost:$MIRROR_PORT"
MAIN_ALLOWED_HOSTS=$(grep '^AUTH_ALLOWED_HOSTS=' "$TMPFILE" | head -n1 | cut -d= -f2- || true)
WORKTREE_ALLOWED_HOSTS="localhost:*,127.0.0.1:*"
if [[ -n "$MAIN_ALLOWED_HOSTS" ]]; then
  WORKTREE_ALLOWED_HOSTS="$MAIN_ALLOWED_HOSTS,$WORKTREE_ALLOWED_HOSTS"
fi

echo ""
echo "Setting worktree-specific auth origin:"
echo "  SITE_URL=$WORKTREE_SITE_URL"
echo "  AUTH_ALLOWED_HOSTS=$WORKTREE_ALLOWED_HOSTS"
(cd "$GIT_ROOT/packages/convex" && pnpm exec convex env set SITE_URL "$WORKTREE_SITE_URL" >/dev/null)
(cd "$GIT_ROOT/packages/convex" && pnpm exec convex env set AUTH_ALLOWED_HOSTS "$WORKTREE_ALLOWED_HOSTS" >/dev/null)

echo ""
echo "Synced $COUNT env vars from main → this worktree's deployment."
