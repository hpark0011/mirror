#!/bin/bash
# Finalize a provisioned worktree in dependency order: app Convex coords,
# deployment secrets, Convex push+seed, then owner allowlist. Safe to rerun
# after a partial setup.

set -e

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
source "$SCRIPT_DIR/worktree-lib.sh"

GIT_ROOT=$(worktree_git_root)
MAIN_ROOT=$(worktree_find_main_root || true)

if [[ -z "$MAIN_ROOT" || "$GIT_ROOT" == "$MAIN_ROOT" ]]; then
  echo "Error: finalize-worktree.sh must be run from inside a worktree, not the main checkout." >&2
  if [[ -z "$MAIN_ROOT" ]]; then
    echo "       Could not find main checkout. Set MIRROR_CANONICAL_ROOT if needed." >&2
  fi
  exit 1
fi

CONVEX_ENV="$GIT_ROOT/packages/convex/.env.local"
if [[ ! -f "$CONVEX_ENV" ]]; then
  echo "Error: $CONVEX_ENV not found." >&2
  echo "       Run ./scripts/provision-worktree-convex.sh first to create the dev deployment." >&2
  exit 1
fi

cd "$GIT_ROOT"

echo "==> Step 1/4: sync-worktree-convex-env.sh (apps/mirror/.env.local coords)"
./scripts/sync-worktree-convex-env.sh
echo ""

echo "==> Step 2/4: sync-worktree-convex-secrets.sh (deployment env vars)"
./scripts/sync-worktree-convex-secrets.sh
echo ""

echo "==> Step 3/4: convex dev --once --run seed:seedRickRubinDemo (push code + seed)"
(cd "$GIT_ROOT/packages/convex" && pnpm exec convex dev --once --run seed:seedRickRubinDemo)
echo ""

echo "==> Step 4/4: allowlist-worktree-owner.sh (betaAllowlist for git user.email)"
./scripts/allowlist-worktree-owner.sh
echo ""

MIRROR_PORT=$(node "$GIT_ROOT/scripts/with-worktree-port.mjs" mirror --print)

cat <<EOF
Worktree finalized. Start the dev servers:
  pnpm dev:safe                       # http://localhost:$MIRROR_PORT
EOF
