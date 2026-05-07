#!/bin/bash
# Create a new git worktree for parallel development.
#
# Usage: new-worktree.sh <branch-name>
#
# Steps:
#   1. Validate the branch-name argument.
#   2. Verify apps/mirror/.env.local is present in main. (gitignored, only
#      lives in the main checkout — the worktree inherits a copy in step 5.)
#   3. Create a fresh worktree under .worktrees/<branch-name> branched off main.
#   4. Install dependencies with pnpm.
#   5. COPY apps/mirror/.env.local from main (no symlink — see worktrees.md).
#      packages/convex/.env.local is intentionally NOT seeded; the user
#      provisions a per-worktree dev Convex deployment on first run of
#      `pnpm --filter=@feel-good/convex dev`. This makes cross-worktree
#      schema divergence impossible (sibling branches' `convex dev` push
#      can no longer be broken by a field one branch wrote on a shared
#      deployment).

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

# --- 4. Install dependencies -------------------------------------------------
# --frozen-lockfile: lockfile in this worktree is exactly main's, so skip
#   resolution. Errors loudly if main's lockfile and package.json have drifted —
#   that should be fixed in main, not papered over here.
# --prefer-offline: try the local pnpm content-addressable store first; only
#   hit the registry for genuinely uncached packages.
# --reporter=append-only: line-based output, no progress-bar redraws polluting
#   the tool result.

cd "$WORKTREE_PATH"
pnpm install --frozen-lockfile --prefer-offline --reporter=append-only

# --- 5. Seed the worktree's env files ---------------------------------------
# Copy (not symlink) apps/mirror/.env.local so this worktree's secrets are
# decoupled from main and from sibling worktrees. The Convex coords in this
# file (CONVEX_DEPLOYMENT, NEXT_PUBLIC_CONVEX_URL, NEXT_PUBLIC_CONVEX_SITE_URL)
# still point at main's dev Convex deployment until the user runs the
# next-step commands printed below.

APP_ENV_DEST="$WORKTREE_PATH/$APP_ENV_REL"
mkdir -p "$(dirname "$APP_ENV_DEST")"
cp "$APP_ENV_SRC" "$APP_ENV_DEST"
echo ""
echo "Copied $APP_ENV_REL from main (independent file — edits here stay here)"

# packages/convex/.env.local is intentionally NOT created. The user runs
# `pnpm --filter=@feel-good/convex dev` in this worktree to provision a
# fresh dev Convex deployment for this branch. See .claude/rules/worktrees.md.

cat <<EOF

Worktree created: $WORKTREE_PATH

Next steps (one-time per worktree):
  1. cd "$WORKTREE_PATH"
  2. pnpm --filter=@feel-good/convex dev
       Choose "create a new project" when prompted. The CLI writes
       packages/convex/.env.local with this worktree's deployment coords.
  3. ./scripts/sync-worktree-convex-env.sh
       Rewrites the three CONVEX_* lines in apps/mirror/.env.local so
       Next.js targets this worktree's deployment.
  4. ./scripts/sync-worktree-convex-secrets.sh
       Copies BETTER_AUTH_SECRET, GOOGLE_*, ANTHROPIC_API_KEY, etc. from
       main's deployment into this worktree's deployment.
  5. pnpm --filter=@feel-good/convex exec convex run seed:seedRickRubinDemo
       Populates this deployment with the rick-rubin demo workspace
       (3 articles, 10 posts, 2 chat conversations). Browse at
       http://localhost:3001/@rick-rubin once \`pnpm dev:safe\` is up.

Why a per-worktree deployment? See .claude/rules/worktrees.md.

EOF
