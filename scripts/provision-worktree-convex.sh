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

# Find main's checkout (one level up from .worktrees/<branch>/).
MAIN_ROOT="${GIT_ROOT%/.worktrees/*}"
MAIN_CONVEX_ENV="$MAIN_ROOT/packages/convex/.env.local"

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

BRANCH=$(basename "$GIT_ROOT")

# Convex deployment reference format: <team>:<project>:dev/<namespace>/<branch>.
# The full team:project: prefix is required because a fresh worktree has
# no packages/convex/.env.local for the CLI to infer project context from
# — without the prefix, `deployment create` falls back to anonymous-mode
# (local-only) and rejects `--type dev`.
DEPLOYMENT_REF="$TEAM:$PROJECT:dev/$USER-claude/$BRANCH"

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
