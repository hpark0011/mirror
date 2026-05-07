#!/bin/bash
# Finalize a fresh worktree's dev Convex deployment in one step.
#
# Prerequisite: `pnpm --filter=@feel-good/convex dev` has been run once
# in this worktree and "create a new project" was chosen at the prompt,
# so packages/convex/.env.local exists with this worktree's deployment
# coords. That step is interactive and can't be automated — every other
# step can.
#
# This wrapper runs, in order:
#   1. ./scripts/sync-worktree-convex-env.sh
#        Rewrites the three CONVEX_* lines in apps/mirror/.env.local so
#        Next.js targets this worktree's deployment.
#   2. ./scripts/sync-worktree-convex-secrets.sh
#        Copies Convex env secrets from main's deployment, sets SITE_URL
#        + AUTH_ALLOWED_HOSTS for this worktree's stable Mirror port,
#        and auto-allowlists `git config user.email` in `betaAllowlist`
#        so first Google sign-in clears the BETA_CLOSED gate.
#   3. convex run seed:seedRickRubinDemo
#        Populates this deployment with the rick-rubin demo workspace
#        (idempotent — re-runs are no-ops if data exists).
#
# Idempotent end-to-end. Safe to re-run if any step fails partway.

set -e

GIT_ROOT=$(git rev-parse --show-toplevel)

# git worktrees have .git as a file (gitdir pointer); main checkout has .git as a directory
if [[ -d "$GIT_ROOT/.git" ]]; then
  echo "Error: finalize-worktree.sh must be run from inside a worktree, not the main checkout." >&2
  echo "       Detected .git/ as a directory (main checkout indicator) at $GIT_ROOT" >&2
  exit 1
fi

# Prerequisite check: convex dev must have written .env.local first.
CONVEX_ENV="$GIT_ROOT/packages/convex/.env.local"
if [[ ! -f "$CONVEX_ENV" ]]; then
  echo "Error: $CONVEX_ENV not found." >&2
  echo "       Run \`pnpm --filter=@feel-good/convex dev\` first and choose" >&2
  echo "       \"create a new project\" when prompted. That writes the file" >&2
  echo "       this script depends on." >&2
  exit 1
fi

cd "$GIT_ROOT"

echo "==> Step 1/3: sync-worktree-convex-env.sh"
./scripts/sync-worktree-convex-env.sh
echo ""

echo "==> Step 2/3: sync-worktree-convex-secrets.sh"
./scripts/sync-worktree-convex-secrets.sh
echo ""

echo "==> Step 3/3: seed:seedRickRubinDemo"
pnpm --filter=@feel-good/convex exec convex run seed:seedRickRubinDemo
echo ""

MIRROR_PORT=$(node "$GIT_ROOT/scripts/with-worktree-port.mjs" mirror --print)

cat <<EOF
Worktree finalized. You can now:
  pnpm dev:safe                       # start Mirror at http://localhost:$MIRROR_PORT
  open http://localhost:$MIRROR_PORT/@rick-rubin
EOF
