#!/bin/bash
# Create a new git worktree for parallel development.
#
# Usage: new-worktree.sh <branch-name>
#
# Steps:
#   1. Validate the branch-name argument.
#   2. Verify the canonical .env.local set is present in main. These files are
#      gitignored, so they only live in the main checkout — the worktree
#      inherits them via symlink in step 5. If any are missing in main, the
#      worktree starts half-configured and dev tools (Next.js, Convex CLI)
#      silently prompt or fail on first run. Bail loudly here so the missing
#      file is fixed once in main, not rediscovered in every new worktree.
#   3. Create a fresh worktree under .worktrees/<branch-name> branched off main.
#   4. Install dependencies with pnpm.
#   5. Symlink every .env.local from the main repo into the new worktree.

set -e  # Exit immediately on any failed command.

# --- 1. Validate input -------------------------------------------------------

BRANCH_NAME="$1"
[[ -z "$BRANCH_NAME" ]] && echo "Error: branch name required" && exit 1

# Resolve repo root so the script works no matter where it's invoked from.
GIT_ROOT=$(git rev-parse --show-toplevel)
WORKTREE_PATH="$GIT_ROOT/.worktrees/$BRANCH_NAME"

# Bail out if a worktree already lives at the target path — never overwrite.
[[ -d "$WORKTREE_PATH" ]] && echo "Error: worktree already exists at $WORKTREE_PATH" && exit 1

# --- 2. Verify canonical .env.local set is present in main ------------------
# Each entry: <relative-path-from-repo-root>|<seed hint shown if missing>.

REQUIRED_ENVS=(
  "apps/mirror/.env.local|copy from apps/mirror/.env.local.example and fill in values"
  "packages/convex/.env.local|run \`pnpm --filter=@feel-good/convex dev\` once in main to let the Convex CLI seed it"
)

MISSING=()
for entry in "${REQUIRED_ENVS[@]}"; do
  rel="${entry%%|*}"
  [[ -f "$GIT_ROOT/$rel" ]] || MISSING+=("$entry")
done

if (( ${#MISSING[@]} > 0 )); then
  echo "Error: required .env.local files are missing from main repo:" >&2
  for entry in "${MISSING[@]}"; do
    rel="${entry%%|*}"
    hint="${entry#*|}"
    echo "  $rel" >&2
    echo "    seed: $hint" >&2
  done
  exit 1
fi

# --- 3. Create the worktree --------------------------------------------------

# Ensure the .worktrees/ container directory exists.
mkdir -p "$GIT_ROOT/.worktrees"

# Create a new branch from main and check it out into the worktree path.
# --quiet suppresses the per-percent "Updating files:" progress spam.
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

# --- 5. Symlink .env.local files --------------------------------------------
# .env.local is gitignored, so the worktree starts without any local secrets.
# We symlink (not copy) so updates in the main checkout flow through automatically.
# Step 2 already asserted REQUIRED_ENVS exists in main; iterate that canonical
# list directly rather than re-discovering with find.

echo ""
echo "Symlinking .env.local files..."
for entry in "${REQUIRED_ENVS[@]}"; do
  rel="${entry%%|*}"
  src="$GIT_ROOT/$rel"
  dest="$WORKTREE_PATH/$rel"

  mkdir -p "$(dirname "$dest")"
  ln -s "$src" "$dest"
  echo "  Linked $rel"
done

echo ""
echo "Worktree created: $WORKTREE_PATH"
