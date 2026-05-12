#!/bin/bash
# Allowlist the worktree owner's git email in this worktree's deployment,
# so first Google sign-in doesn't trip the BETA_CLOSED gate
# (`?error=unable_to_create_user`).
#
# Prerequisite: Convex code is already pushed to this worktree's
# deployment — this script invokes `betaAllowlist/mutations` and
# `betaAllowlist/queries` server functions. `finalize-worktree.sh` calls
# this AFTER `convex dev --once --run seed:seedRickRubinDemo` pushes the
# code.
#
# Idempotent: the mutation lowercases on write and no-ops on duplicate,
# the verify step is a read.

set -e

GIT_ROOT=$(git rev-parse --show-toplevel)

if [[ "$GIT_ROOT" != */.worktrees/* ]]; then
  echo "Error: allowlist-worktree-owner.sh must be run from inside a worktree." >&2
  exit 1
fi

OWNER_EMAIL=$(git config user.email 2>/dev/null || true)
if [[ -z "$OWNER_EMAIL" ]]; then
  echo "Error: \`git config user.email\` is empty; cannot auto-allowlist worktree owner." >&2
  echo "       Set it with: git config --global user.email you@example.com" >&2
  exit 1
fi

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
  echo "       If the error mentions \"Could not find function\", code may not be pushed yet." >&2
  echo "       Run \`pnpm --filter=@feel-good/convex exec convex dev --once\` first." >&2
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

echo "Allowlisted: $OWNER_EMAIL"
