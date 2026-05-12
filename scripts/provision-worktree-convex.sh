#!/bin/bash
# Provision a per-worktree Convex dev deployment, non-interactively.
#
# Creates an EMPTY deployment shell and writes packages/convex/.env.local.
# That's it — no code push, no seed. Pushing the code requires the
# deployment's server-side env vars (SITE_URL, GOOGLE_CLIENT_*, etc.) to
# be set first, because `packages/convex/convex/env.ts` validates them at
# module-load time. Those env vars are synced by
# `sync-worktree-convex-secrets.sh`, which runs from `finalize-worktree.sh`
# AFTER this script. Push + seed + owner allowlist also live in
# `finalize-worktree.sh`.
#
# Background: Convex's "many parallel feature branches" workflow
# (https://docs.convex.dev/production/multiple-deployments) creates a
# separate dev deployment under the SAME project for each branch, named
# `dev/<namespace>/<branch>`. No new Convex project, no interactive prompt.
#
# Prerequisite: the user is logged in to the Convex CLI on this machine
# (`npx convex login`). The auth carries across worktrees.

set -e

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
source "$SCRIPT_DIR/worktree-lib.sh"

GIT_ROOT=$(worktree_git_root)
MAIN_ROOT=$(worktree_find_main_root || true)

# Refuse to run from main checkout — main has its own permanent dev
# deployment and we should not clobber its .env.local.
if [[ -z "$MAIN_ROOT" || "$GIT_ROOT" == "$MAIN_ROOT" ]]; then
  echo "Error: provision-worktree-convex.sh must be run from inside a worktree." >&2
  echo "       Detected GIT_ROOT=$GIT_ROOT" >&2
  if [[ -z "$MAIN_ROOT" ]]; then
    echo "       Could not find main checkout. Set MIRROR_CANONICAL_ROOT if needed." >&2
  fi
  exit 1
fi

MAIN_CONVEX_ENV="$MAIN_ROOT/packages/convex/.env.local"
THIS_CONVEX_ENV="$GIT_ROOT/packages/convex/.env.local"

if [[ ! -f "$MAIN_CONVEX_ENV" ]]; then
  echo "Error: $MAIN_CONVEX_ENV not found." >&2
  echo "       Cannot derive Convex team/project for this worktree's new deployment." >&2
  exit 1
fi

# Parse the team and project from main's `CONVEX_DEPLOYMENT=` line — the
# Convex CLI writes them as a trailing comment, e.g.
#   CONVEX_DEPLOYMENT=dev:quick-turtle-404 # team: hyunsol-park, project: mirror
TEAM=$(grep '^CONVEX_DEPLOYMENT=' "$MAIN_CONVEX_ENV" | sed -nE 's/.*team:[[:space:]]*([^,[:space:]]+).*/\1/p')
PROJECT=$(grep '^CONVEX_DEPLOYMENT=' "$MAIN_CONVEX_ENV" | sed -nE 's/.*project:[[:space:]]*([^,[:space:]]+).*/\1/p')

if [[ -z "$TEAM" || -z "$PROJECT" ]]; then
  echo "Error: could not parse \`team:\` and \`project:\` from $MAIN_CONVEX_ENV." >&2
  echo "       Expected line format:" >&2
  echo "         CONVEX_DEPLOYMENT=dev:slug # team: <team>, project: <project>" >&2
  exit 1
fi

MAIN_DEP=$(worktree_read_convex_deployment "$MAIN_CONVEX_ENV")
THIS_DEP=$(worktree_read_convex_deployment "$THIS_CONVEX_ENV")
DEPLOYMENT_NAME=$(worktree_deployment_name "$GIT_ROOT")
EXPIRATION="${CONVEX_WORKTREE_EXPIRATION:-in 7 days}"

# Convex deployment reference format: <team>:<project>:dev/<namespace>/<branch>.
# The full team:project: prefix is required because a fresh worktree has
# no packages/convex/.env.local for the CLI to infer project context from
# — without the prefix, `deployment create` falls back to anonymous-mode
# (local-only) and rejects `--type dev`.
DEPLOYMENT_REF="$TEAM:$PROJECT:dev/${CONVEX_WORKTREE_NAMESPACE:-$USER-claude}/$DEPLOYMENT_NAME"

if [[ -L "$THIS_CONVEX_ENV" ]]; then
  echo "Removing shared Convex env symlink: $THIS_CONVEX_ENV"
  rm "$THIS_CONVEX_ENV"
  THIS_DEP=""
fi

if [[ -n "$THIS_DEP" && "$THIS_DEP" != dev:* ]]; then
  echo "Error: refusing to reuse non-dev Convex deployment in a worktree: $THIS_DEP" >&2
  exit 1
fi

if [[ -f "$THIS_CONVEX_ENV" ]]; then
  if [[ "$THIS_DEP" == "$MAIN_DEP" ]]; then
    echo "Replacing shared Convex env: $THIS_CONVEX_ENV"
  elif [[ -n "$THIS_DEP" ]]; then
    echo "Replacing existing Convex env ($THIS_DEP) with worktree deployment: $DEPLOYMENT_REF"
  else
    echo "Replacing malformed Convex env: $THIS_CONVEX_ENV"
  fi
  rm "$THIS_CONVEX_ENV"
fi

echo "Provisioning Convex dev deployment: $DEPLOYMENT_REF"
echo "Deployment expiration: $EXPIRATION"
cd "$GIT_ROOT/packages/convex"

# Create the deployment and select it (writes .env.local).
# Code push + seed happen later in finalize-worktree.sh, once env vars
# have been synced onto this deployment. If a partial setup already created
# the deployment, selecting it makes reruns idempotent.
if ! pnpm exec convex deployment create "$DEPLOYMENT_REF" --type dev --select --expiration "$EXPIRATION"; then
  echo ""
  echo "Create failed; trying to select an existing deployment..."
  pnpm exec convex deployment select "$DEPLOYMENT_REF"
fi

echo ""
echo "Convex deployment provisioned (empty)."
echo "Next: run ./scripts/finalize-worktree.sh to sync env, push code, seed data, and allowlist owner."
