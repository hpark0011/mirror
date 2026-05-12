#!/bin/bash
# Create a new git worktree for parallel development.
#
# Usage: new-worktree.sh <branch-name>
#
# Creates .worktrees/<branch-name>, installs deps, copies the app env,
# provisions a per-worktree Convex dev deployment, then finalizes env/secrets,
# code push, seed data, and owner allowlist. See .agents/rules/worktrees.md.

set -e  # Exit immediately on any failed command.

# --- 1. Validate input -------------------------------------------------------

BRANCH_NAME="$1"
[[ -z "$BRANCH_NAME" ]] && echo "Error: branch name required" && exit 1

GIT_ROOT=$(git rev-parse --show-toplevel)
WORKTREE_PATH="$GIT_ROOT/.worktrees/$BRANCH_NAME"

[[ -d "$WORKTREE_PATH" ]] && echo "Error: worktree already exists at $WORKTREE_PATH" && exit 1

# --- 2. Verify apps/mirror/.env.local is present in main --------------------

APP_ENV_REL="apps/mirror/.env.local"
APP_ENV_SRC="$GIT_ROOT/$APP_ENV_REL"

if [[ ! -f "$APP_ENV_SRC" ]]; then
  echo "Error: $APP_ENV_REL is missing from the main repo." >&2
  echo "  seed: copy from apps/mirror/.env.local.example and fill in values" >&2
  exit 1
fi

# --- 3. Create the worktree --------------------------------------------------

mkdir -p "$GIT_ROOT/.worktrees"
git worktree add --quiet -b "$BRANCH_NAME" "$WORKTREE_PATH" main

# --- 4. Run local setup ------------------------------------------------------

cd "$WORKTREE_PATH"
pnpm install --frozen-lockfile --prefer-offline --reporter=append-only

# --- 5. Seed the worktree's env files ---------------------------------------
# Copy (not symlink) apps/mirror/.env.local so this worktree's secrets are
# decoupled from main and from sibling worktrees.

APP_ENV_DEST="$WORKTREE_PATH/$APP_ENV_REL"
mkdir -p "$(dirname "$APP_ENV_DEST")"
cp "$APP_ENV_SRC" "$APP_ENV_DEST"
echo ""
echo "Copied $APP_ENV_REL from main"

# --- 6. Provision an expiring per-worktree Convex dev deployment ------------
# Empty shell only; finalize handles env vars, code push, seed, and allowlist.

echo ""
echo "==> Provisioning Convex dev deployment (empty shell)"
"$WORKTREE_PATH/scripts/provision-worktree-convex.sh"

# --- 7. Finalize: env coords -> deployment env vars -> code push + seed -> allowlist ---
# Order matters here. `convex env.ts` validates SITE_URL / GOOGLE_* at
# module load, so secrets must be synced before the code push. The
# betaAllowlist mutation can only run after code is pushed.

echo ""
echo "==> Finalizing worktree (env coords, secrets, push+seed, owner allowlist)"
"$WORKTREE_PATH/scripts/finalize-worktree.sh"

cat <<EOF

Worktree ready: $WORKTREE_PATH

Start the dev servers:
  cd "$WORKTREE_PATH" && pnpm dev:safe

EOF
