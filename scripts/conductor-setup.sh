#!/usr/bin/env bash
# One-shot workspace setup for Conductor (and other auto-provisioning
# worktree harnesses). Idempotent — safe to rerun.
#
# Steps:
#   1. pnpm install
#   2. Seed apps/mirror/.env.local from main if missing (gitignored — `git
#      worktree add` doesn't carry it)
#   3. provision-worktree-convex.sh (create this worktree's Convex dev
#      deployment + write packages/convex/.env.local)
#   4. finalize-worktree.sh (sync env coords + secrets, push Convex code,
#      seed Rick demo, allowlist git user.email)
#
# Skips steps that have already completed:
#   - pnpm install is always run (it's fast on cache hit)
#   - .env.local copy skipped if the file already exists
#   - Convex provisioning skipped if packages/convex/.env.local exists
#     with a CONVEX_DEPLOYMENT line
#   - finalize is always run (each child script is itself idempotent)
#
# Paste into Conductor's per-project Run scripts field as:
#   ./scripts/conductor-setup.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GIT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
# shellcheck source=./worktree-lib.sh
source "$SCRIPT_DIR/worktree-lib.sh"
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

log "1/4 pnpm install"
pnpm install

APP_ENV="$GIT_ROOT/apps/mirror/.env.local"
if [[ -f "$APP_ENV" ]]; then
  log "2/4 apps/mirror/.env.local (skipped — already present)"
else
  MAIN_ROOT="$(worktree_find_main_root || true)"
  if [[ -z "$MAIN_ROOT" ]]; then
    fail "Could not locate main checkout. Set MIRROR_CANONICAL_ROOT to its path and rerun."
  fi
  MAIN_APP_ENV="$MAIN_ROOT/apps/mirror/.env.local"
  if [[ ! -f "$MAIN_APP_ENV" ]]; then
    fail "$MAIN_APP_ENV is missing in main. Seed it from apps/mirror/.env.local.example first."
  fi
  log "2/4 copying apps/mirror/.env.local from $MAIN_ROOT"
  mkdir -p "$(dirname "$APP_ENV")"
  cp "$MAIN_APP_ENV" "$APP_ENV"
fi

CONVEX_ENV="$GIT_ROOT/packages/convex/.env.local"
# Only skip provisioning when the existing env is provably safe — a real
# file (not a symlink to main), a `dev:` deployment, and distinct from
# main's. Anything else falls through to provision-worktree-convex.sh,
# which has the canonical guards (symlink removal, non-dev refusal,
# shared/malformed env replacement).
CONVEX_SKIP_REASON=""
if [[ -L "$CONVEX_ENV" ]]; then
  CONVEX_SKIP_REASON="symlink — provision will replace"
elif [[ ! -f "$CONVEX_ENV" ]]; then
  CONVEX_SKIP_REASON="missing"
else
  THIS_DEP=$(worktree_read_convex_deployment "$CONVEX_ENV")
  if [[ -z "$THIS_DEP" ]]; then
    CONVEX_SKIP_REASON="no CONVEX_DEPLOYMENT line"
  elif [[ "$THIS_DEP" != dev:* ]]; then
    CONVEX_SKIP_REASON="non-dev deployment ($THIS_DEP) — provision will refuse"
  else
    MAIN_ROOT_FOR_CONVEX="$(worktree_find_main_root || true)"
    if [[ -n "$MAIN_ROOT_FOR_CONVEX" ]]; then
      MAIN_DEP=$(worktree_read_convex_deployment "$MAIN_ROOT_FOR_CONVEX/packages/convex/.env.local")
      if [[ -n "$MAIN_DEP" && "$THIS_DEP" == "$MAIN_DEP" ]]; then
        CONVEX_SKIP_REASON="shared with main ($MAIN_DEP)"
      fi
    fi
  fi
fi

if [[ -z "$CONVEX_SKIP_REASON" ]]; then
  log "3/4 provision-worktree-convex.sh (skipped — $CONVEX_ENV already has worktree dev deployment)"
else
  log "3/4 provision-worktree-convex.sh ($CONVEX_SKIP_REASON)"
  ./scripts/provision-worktree-convex.sh
fi

log "4/4 finalize-worktree.sh"
./scripts/finalize-worktree.sh

log "Done. Start the dev server with: pnpm dev:safe"
