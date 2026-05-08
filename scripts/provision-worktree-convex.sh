#!/bin/bash
# Provision a per-worktree Convex dev deployment, non-interactively.
#
# Background: Convex's "many parallel feature branches" workflow
# (https://docs.convex.dev/production/multiple-deployments) creates a
# separate dev deployment under the SAME project for each branch, named
# `dev/<namespace>/<branch>`. No new Convex project, no interactive prompt.
#
# Prerequisite: the user is logged in to the Convex CLI on this machine
# (`npx convex login`). The auth carries across worktrees.

set -e

GIT_ROOT=$(git rev-parse --show-toplevel)

# Refuse to run from main checkout — main has its own permanent dev
# deployment and we should not clobber its .env.local.
if [[ "$GIT_ROOT" != *"/.worktrees/"* ]]; then
  echo "Error: provision-worktree-convex.sh must be run from inside a worktree." >&2
  echo "       Detected GIT_ROOT=$GIT_ROOT" >&2
  exit 1
fi

BRANCH=$(basename "$GIT_ROOT")

# Convex deployment reference format: dev/<namespace>/<branch>.
# `--select` writes this deployment into packages/convex/.env.local.
# The CLI infers team + project from the workspace's existing Convex
# context (machine-wide login + the project linkage).
DEPLOYMENT_REF="dev/$USER-claude/$BRANCH"

echo "Provisioning Convex dev deployment: $DEPLOYMENT_REF"
cd "$GIT_ROOT/packages/convex"

# Step 1: create the deployment and select it (writes .env.local).
pnpm exec convex deployment create "$DEPLOYMENT_REF" --type dev --select

# Step 2: push code + seed in one shot (file-watch off via --once).
echo ""
echo "Pushing code + seeding rick-rubin demo..."
pnpm exec convex dev --once --run seed:seedRickRubinDemo

echo ""
echo "Convex deployment provisioned: $DEPLOYMENT_REF"
