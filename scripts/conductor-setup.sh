#!/usr/bin/env bash
# One-shot workspace setup for Conductor (and other auto-provisioning
# worktree harnesses). Idempotent — safe to rerun.
#
# Steps:
#   1. pnpm install
#   2. provision-worktree-convex.sh (create this worktree's Convex dev
#      deployment + write packages/convex/.env.local)
#   3. finalize-worktree.sh (sync env coords + secrets, push Convex code,
#      seed Rick demo, allowlist git user.email)
#
# Skips steps that have already completed:
#   - pnpm install is always run (it's fast on cache hit)
#   - Convex provisioning skipped if packages/convex/.env.local exists
#     with a CONVEX_DEPLOYMENT line
#   - finalize is always run (each child script is itself idempotent)
#
# Paste into Conductor's per-project Run scripts field as:
#   ./scripts/conductor-setup.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GIT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$GIT_ROOT"

log() {
  printf "\n==> %s\n" "$*"
}

fail() {
  printf "\nconductor-setup: %s\n" "$*" >&2
  exit 1
}

if ! command -v pnpm >/dev/null 2>&1; then
  fail "pnpm not found on PATH. Conductor's shell may not inherit your full PATH — set it in the workspace settings or install pnpm globally."
fi

if ! git config user.email >/dev/null 2>&1 || [[ -z "$(git config user.email)" ]]; then
  fail "\`git config user.email\` is empty. allowlist-worktree-owner.sh needs it. Set it (globally or for this repo) and rerun."
fi

log "1/3 pnpm install"
pnpm install

CONVEX_ENV="$GIT_ROOT/packages/convex/.env.local"
if [[ -f "$CONVEX_ENV" ]] && grep -q '^CONVEX_DEPLOYMENT=' "$CONVEX_ENV"; then
  log "2/3 provision-worktree-convex.sh (skipped — $CONVEX_ENV already has CONVEX_DEPLOYMENT)"
else
  log "2/3 provision-worktree-convex.sh"
  ./scripts/provision-worktree-convex.sh
fi

log "3/3 finalize-worktree.sh"
./scripts/finalize-worktree.sh

log "Done. Start the dev server with: pnpm dev:safe"
