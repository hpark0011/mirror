#!/bin/bash
# Finalize a fresh worktree — takes an EMPTY Convex dev deployment and
# brings it to a usable state: env coords in apps/mirror/.env.local,
# server-side env secrets, deployed code, seeded demo content, and an
# allowlisted owner email for first Google sign-in.
#
# Prerequisite: provision-worktree-convex.sh has run, so
# packages/convex/.env.local exists and points at this worktree's
# deployment. new-worktree.sh runs both back-to-back; manual users only
# need this if recovering from a partial setup.
#
# Steps run in strict dependency order — earlier steps unblock later
# ones, and re-running any earlier step alone is safe:
#
#   1. sync-worktree-convex-env.sh
#        Rewrites the three CONVEX_* lines in apps/mirror/.env.local so
#        Next.js targets this worktree's deployment. Independent of the
#        deployment's state.
#   2. sync-worktree-convex-secrets.sh
#        Pushes BETTER_AUTH_SECRET, GOOGLE_*, OAUTH_PROXY_*, etc. from
#        main's deployment env into this worktree's. Sets worktree-specific
#        SITE_URL + AUTH_ALLOWED_HOSTS + DEV_AUTOSEED_OWNER.
#        Must run BEFORE step 3: env.ts validates these at module load,
#        so the first code push fails without them.
#   3. convex dev --once --run seed:seedRickRubinDemo
#        Pushes Convex code AND seeds the rick-rubin demo. Push fails
#        without step 2; seed fails without push. `--once` skips the
#        file-watcher.
#   4. allowlist-worktree-owner.sh
#        Calls betaAllowlist/mutations:addAllowlistEntry for
#        `git config user.email`, then verifies via the query. Requires
#        step 3 (the mutation only exists once code is deployed).
#
# Idempotent end-to-end.

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
