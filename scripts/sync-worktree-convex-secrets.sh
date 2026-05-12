#!/bin/bash
# Sync Convex env secrets from main into this worktree's deployment before
# the first code push. Idempotent; preserves the CLI's round-trippable
# `env list` -> `env set --force` path so multi-line values survive.

set -e

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
source "$SCRIPT_DIR/worktree-lib.sh"

GIT_ROOT=$(worktree_git_root)
MAIN_ROOT=$(worktree_find_main_root || true)

if [[ -z "$MAIN_ROOT" || "$GIT_ROOT" == "$MAIN_ROOT" ]]; then
  echo "Error: this script must be run from a worktree, not main." >&2
  if [[ -z "$MAIN_ROOT" ]]; then
    echo "       Could not find main checkout. Set MIRROR_CANONICAL_ROOT if needed." >&2
  fi
  exit 1
fi

MAIN_CONVEX_ENV="$MAIN_ROOT/packages/convex/.env.local"
THIS_CONVEX_ENV="$GIT_ROOT/packages/convex/.env.local"

[[ -f "$MAIN_CONVEX_ENV" ]] || { echo "Error: $MAIN_CONVEX_ENV not found." >&2; exit 1; }
[[ -f "$THIS_CONVEX_ENV" ]] || { echo "Error: $THIS_CONVEX_ENV not found. Run \`./scripts/provision-worktree-convex.sh\` first." >&2; exit 1; }

# The two deployments MUST be different. Otherwise the script would echo
# main's env back into itself — and on a misconfigured worktree where
# packages/convex/.env.local is still a symlink to main's, that's an
# infinite loop on a single deployment.
MAIN_DEP=$(grep '^CONVEX_DEPLOYMENT=' "$MAIN_CONVEX_ENV" | head -n1 | cut -d= -f2- | awk '{print $1}')
THIS_DEP=$(grep '^CONVEX_DEPLOYMENT=' "$THIS_CONVEX_ENV" | head -n1 | cut -d= -f2- | awk '{print $1}')

if [[ "$MAIN_DEP" == "$THIS_DEP" ]]; then
  echo "Error: this worktree's CONVEX_DEPLOYMENT ($THIS_DEP) is identical to main's." >&2
  echo "       That means the deployment is shared — sync would write main's secrets to itself." >&2
  echo "       Provision a fresh deployment with \`./scripts/provision-worktree-convex.sh\` first." >&2
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
# Merge main's value with the local-dev required entries, then dedupe.
# Re-running the sync used to grow the list (`localhost:*,...,localhost:*,...`).
WORKTREE_ALLOWED_HOSTS=$(printf '%s,localhost:*,127.0.0.1:*' "$MAIN_ALLOWED_HOSTS" \
  | tr ',' '\n' \
  | awk 'NF && !seen[$0]++' \
  | paste -sd, -)

echo ""
echo "Setting worktree-specific auth origin:"
echo "  SITE_URL=$WORKTREE_SITE_URL"
echo "  AUTH_ALLOWED_HOSTS=$WORKTREE_ALLOWED_HOSTS"
echo "  DEV_AUTOSEED_OWNER=true"
(cd "$GIT_ROOT/packages/convex" && pnpm exec convex env set SITE_URL "$WORKTREE_SITE_URL" >/dev/null)
(cd "$GIT_ROOT/packages/convex" && pnpm exec convex env set AUTH_ALLOWED_HOSTS "$WORKTREE_ALLOWED_HOSTS" >/dev/null)
# Trigger auth/client.ts user.onCreate to seed Rick's content under the
# owner's account on first sign-in. Never set on production (auto-seed
# cloning on prod would silently inject Rick's articles into real users'
# profiles).
(cd "$GIT_ROOT/packages/convex" && pnpm exec convex env set DEV_AUTOSEED_OWNER "true" >/dev/null)

echo ""
echo "Synced $COUNT env vars from main → this worktree's deployment."
echo "Owner allowlist runs separately via allowlist-worktree-owner.sh (needs code pushed first)."
