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
# Implementation note: Convex CLI v1.33+ supports round-tripping
# `convex env list` output into `convex env set` stdin. Keep that path
# intact so multi-line values survive.

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

# Pull all env vars from main in the CLI's round-trippable format.
TMPFILE=$(mktemp)
ERRFILE=$(mktemp)
trap 'rm -f "$TMPFILE" "$ERRFILE"' EXIT

if ! (cd "$MAIN_ROOT/packages/convex" && pnpm exec convex env list) > "$TMPFILE" 2> "$ERRFILE"; then
  echo "Error: \`convex env list\` failed. Is main's deployment reachable?" >&2
  if [[ -s "$ERRFILE" ]]; then
    cat "$ERRFILE" >&2
  fi
  exit 1
fi

if [[ ! -s "$TMPFILE" ]]; then
  echo "Error: \`convex env list\` returned no output. Is main's deployment reachable?" >&2
  if [[ -s "$ERRFILE" ]]; then
    cat "$ERRFILE" >&2
  fi
  exit 1
fi

COUNT=$(grep -c '^[A-Z_][A-Z0-9_]*=' "$TMPFILE" || true)

if ! (cd "$GIT_ROOT/packages/convex" && pnpm exec convex env set --force < "$TMPFILE"); then
  echo "Error: failed to sync env vars into this worktree's deployment." >&2
  exit 1
fi

MIRROR_PORT=$(node "$GIT_ROOT/scripts/with-worktree-port.mjs" mirror --print)
WORKTREE_SITE_URL="http://localhost:$MIRROR_PORT"
MAIN_ALLOWED_HOSTS=$(grep '^AUTH_ALLOWED_HOSTS=' "$TMPFILE" | head -n1 | cut -d= -f2- || true)
# Merge main's value with the local-dev required entries, then dedupe.
# Re-running the sync used to grow the list (`localhost:*,...,localhost:*,...`).
WORKTREE_ALLOWED_HOSTS=$(printf '%s,localhost:*,127.0.0.1:*' "$MAIN_ALLOWED_HOSTS" \
  | tr ',' '\n' \
  | awk 'NF && !seen[$0]++' \
  | paste -sd, -)

echo ""
echo "Setting worktree-specific auth origin:"
echo "  SITE_URL=$WORKTREE_SITE_URL"
echo "  AUTH_ALLOWED_HOSTS=$WORKTREE_ALLOWED_HOSTS"
echo "  DEV_AUTOSEED_OWNER=true"
(cd "$GIT_ROOT/packages/convex" && pnpm exec convex env set SITE_URL "$WORKTREE_SITE_URL" >/dev/null)
(cd "$GIT_ROOT/packages/convex" && pnpm exec convex env set AUTH_ALLOWED_HOSTS "$WORKTREE_ALLOWED_HOSTS" >/dev/null)
# Trigger auth/client.ts user.onCreate to seed Rick's content under the
# owner's account on first sign-in. Never set on production (auto-seed
# cloning on prod would silently inject Rick's articles into real users'
# profiles).
(cd "$GIT_ROOT/packages/convex" && pnpm exec convex env set DEV_AUTOSEED_OWNER "true" >/dev/null)

# Auto-allowlist the worktree owner so first Google sign-in doesn't trip
# the BETA_CLOSED gate (`?error=unable_to_create_user`). The mutation
# lowercases on write and no-ops on duplicate, so re-running this script
# is safe.
OWNER_EMAIL=$(git config user.email 2>/dev/null || true)
if [[ -z "$OWNER_EMAIL" ]]; then
  echo "" >&2
  echo "Error: \`git config user.email\` is empty; cannot auto-allowlist worktree owner." >&2
  echo "       Set it with: git config --global user.email you@example.com" >&2
  exit 1
fi

echo ""
echo "Allowlisting worktree owner for first Google sign-in:"
echo "  email=$OWNER_EMAIL"
ALLOWLIST_ARG=$(printf '{"email":%s,"note":"worktree owner (auto)"}' \
  "$(node -e 'process.stdout.write(JSON.stringify(process.argv[1]))' "$OWNER_EMAIL")")
QUERY_ARG=$(printf '{"email":%s}' \
  "$(node -e 'process.stdout.write(JSON.stringify(process.argv[1]))' "$OWNER_EMAIL")")

# Run the mutation OUTSIDE a subshell — bash `set -e` does not always propagate
# from `(...)` reliably, which is the silent-failure mode that previously left
# the owner un-allowlisted while the script still printed success.
cd "$GIT_ROOT/packages/convex"
if ! pnpm exec convex run betaAllowlist/mutations:addAllowlistEntry "$ALLOWLIST_ARG" >/dev/null; then
  cd "$GIT_ROOT"
  echo "Error: failed to add $OWNER_EMAIL to betaAllowlist." >&2
  exit 1
fi

# Verify the row landed. Catches the case where the mutation appeared to
# succeed but wrote to a different deployment (stale CONVEX_DEPLOYMENT
# export, CLI auth drift, etc.). Without this check the user would only
# discover the gap when Google OAuth redirects back with
# `?error=unable_to_create_user`.
ALLOWED=$(pnpm exec convex run betaAllowlist/queries:isEmailAllowed "$QUERY_ARG" 2>/dev/null | tail -n1)
cd "$GIT_ROOT"
if [[ "$ALLOWED" != "true" ]]; then
  echo "Error: betaAllowlist verify failed for $OWNER_EMAIL (got: $ALLOWED)." >&2
  echo "       The add mutation reported success but the row isn't readable." >&2
  echo "       Check that packages/convex/.env.local points at this worktree's deployment." >&2
  exit 1
fi

echo ""
echo "Synced $COUNT env vars from main → this worktree's deployment."
echo "Allowlisted: $OWNER_EMAIL"
