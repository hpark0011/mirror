#!/bin/bash
# Finalize a fresh worktree — syncs env coords and Convex secrets into
# this worktree's already-provisioned dev deployment.
#
# Prerequisite: provision-worktree-convex.sh has run, so
# packages/convex/.env.local exists and the deployment is seeded.
# new-worktree.sh runs both scripts back-to-back, so manual users only
# need this if they're recovering from a partial setup.
#
# Steps:
#   1. ./scripts/sync-worktree-convex-env.sh
#        Rewrites the three CONVEX_* lines in apps/mirror/.env.local so
#        Next.js targets this worktree's deployment.
#   2. ./scripts/sync-worktree-convex-secrets.sh
#        Copies Convex env secrets from main's deployment, sets SITE_URL
#        + AUTH_ALLOWED_HOSTS for this worktree's stable Mirror port,
#        and auto-allowlists `git config user.email` in `betaAllowlist`
#        so first Google sign-in clears the BETA_CLOSED gate.
#
# Idempotent end-to-end.

set -e

GIT_ROOT=$(git rev-parse --show-toplevel)

if [[ -d "$GIT_ROOT/.git" ]]; then
  echo "Error: finalize-worktree.sh must be run from inside a worktree, not the main checkout." >&2
  exit 1
fi

CONVEX_ENV="$GIT_ROOT/packages/convex/.env.local"
if [[ ! -f "$CONVEX_ENV" ]]; then
  echo "Error: $CONVEX_ENV not found." >&2
  echo "       Run ./scripts/provision-worktree-convex.sh first to create the dev deployment." >&2
  exit 1
fi

cd "$GIT_ROOT"

echo "==> Step 1/2: sync-worktree-convex-env.sh"
./scripts/sync-worktree-convex-env.sh
echo ""

echo "==> Step 2/2: sync-worktree-convex-secrets.sh"
./scripts/sync-worktree-convex-secrets.sh
echo ""

MIRROR_PORT=$(node "$GIT_ROOT/scripts/with-worktree-port.mjs" mirror --print)

cat <<EOF
Worktree finalized. Start the dev servers:
  pnpm dev:safe                       # http://localhost:$MIRROR_PORT
EOF
