#!/bin/bash
# Sync Convex env secrets from main's dev deployment into the current
# worktree's deployment.
#
# Convex env (BETTER_AUTH_SECRET, GOOGLE_CLIENT_*, ANTHROPIC_API_KEY,
# RESEND_API_KEY, PLAYWRIGHT_TEST_SECRET, etc.) is per-deployment. After
# `pnpm --filter=@feel-good/convex dev` provisions a fresh deployment for
# this worktree, those secrets are missing — server functions that need
# them throw at runtime. This script reads them from main's deployment
# and writes them to this worktree's deployment.
#
# Idempotent: re-running overwrites with the latest values from main.
#
# Implementation note: we parse `convex env list` output as whitespace-
# separated `KEY VALUE` columns, skipping the header line. If Convex CLI
# changes that format, adjust the awk filter below.

set -e

GIT_ROOT=$(git rev-parse --show-toplevel)

# Find main's checkout (one level up from .worktrees/<branch>/).
if [[ "$GIT_ROOT" == */.worktrees/* ]]; then
  MAIN_ROOT="${GIT_ROOT%/.worktrees/*}"
else
  echo "Error: this script must be run from a worktree, not main." >&2
  exit 1
fi

MAIN_CONVEX_ENV="$MAIN_ROOT/packages/convex/.env.local"
THIS_CONVEX_ENV="$GIT_ROOT/packages/convex/.env.local"

[[ -f "$MAIN_CONVEX_ENV" ]] || { echo "Error: $MAIN_CONVEX_ENV not found." >&2; exit 1; }
[[ -f "$THIS_CONVEX_ENV" ]] || { echo "Error: $THIS_CONVEX_ENV not found. Run \`pnpm --filter=@feel-good/convex dev\` first." >&2; exit 1; }

# The two deployments MUST be different. Otherwise the script would echo
# main's env back into itself — and on a misconfigured worktree where
# packages/convex/.env.local is still a symlink to main's, that's an
# infinite loop on a single deployment.
MAIN_DEP=$(grep '^CONVEX_DEPLOYMENT=' "$MAIN_CONVEX_ENV" | head -n1 | cut -d= -f2- | awk '{print $1}')
THIS_DEP=$(grep '^CONVEX_DEPLOYMENT=' "$THIS_CONVEX_ENV" | head -n1 | cut -d= -f2- | awk '{print $1}')

if [[ "$MAIN_DEP" == "$THIS_DEP" ]]; then
  echo "Error: this worktree's CONVEX_DEPLOYMENT ($THIS_DEP) is identical to main's." >&2
  echo "       That means the deployment is shared — sync would write main's secrets to itself." >&2
  echo "       Provision a fresh deployment with \`pnpm --filter=@feel-good/convex dev\` first." >&2
  exit 1
fi

echo "Source deployment (main): $MAIN_DEP"
echo "Target deployment (this): $THIS_DEP"
echo ""

# Pull all env vars from main. `convex env list` prints one KEY=VALUE per
# line, no quoting, no header. Values are the raw secret strings.
TMPFILE=$(mktemp)
trap "rm -f $TMPFILE" EXIT

(cd "$MAIN_ROOT/packages/convex" && pnpm exec convex env list) > "$TMPFILE" 2>/dev/null

if [[ ! -s "$TMPFILE" ]]; then
  echo "Error: \`convex env list\` returned no output. Is main's deployment reachable?" >&2
  exit 1
fi

COUNT=0
while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  # Format: KEY=VALUE. Split on the first '='.
  KEY="${line%%=*}"
  VALUE="${line#*=}"
  # KEY must look like an env-var name. This filters any future header
  # rows or warnings the CLI might emit.
  [[ "$KEY" =~ ^[A-Z_][A-Z0-9_]*$ ]] || continue
  [[ -z "$VALUE" ]] && continue

  echo "  Setting $KEY"
  (cd "$GIT_ROOT/packages/convex" && pnpm exec convex env set "$KEY" "$VALUE" >/dev/null 2>&1) || {
    echo "    Warning: failed to set $KEY (skipping)" >&2
    continue
  }
  COUNT=$((COUNT + 1))
done < "$TMPFILE"

echo ""
echo "Synced $COUNT env vars from main → this worktree's deployment."
