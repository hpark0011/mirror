#!/bin/bash
# Prepare a freshly-created Codex worktree for local development.

set -euo pipefail

CHECK_ONLY=false
if [[ "${1:-}" == "--check" ]]; then
  CHECK_ONLY=true
fi

CURRENT_ROOT=$(git rev-parse --show-toplevel)
CURRENT_ROOT=$(cd "$CURRENT_ROOT" && pwd -P)

find_main_root() {
  local current=""

  while IFS= read -r line; do
    case "$line" in
      worktree\ *)
        current="${line#worktree }"
        ;;
      branch\ refs/heads/main)
        echo "$current"
        return 0
        ;;
    esac
  done < <(git worktree list --porcelain)

  return 1
}

MAIN_ROOT="${MIRROR_CANONICAL_ROOT:-}"
if [[ -z "$MAIN_ROOT" ]]; then
  MAIN_ROOT=$(find_main_root || true)
fi

if [[ -z "$MAIN_ROOT" && -d "/Users/disquiet/Desktop/mirror" ]]; then
  MAIN_ROOT="/Users/disquiet/Desktop/mirror"
fi

if [[ -z "$MAIN_ROOT" ]]; then
  echo "Error: could not find the canonical main checkout for env symlinks." >&2
  echo "Set MIRROR_CANONICAL_ROOT to the main checkout path and rerun." >&2
  exit 1
fi

MAIN_ROOT=$(cd "$MAIN_ROOT" && pwd -P)

REQUIRED_ENVS=(
  "apps/mirror/.env.local|copy from apps/mirror/.env.local.example and fill in values"
  "packages/convex/.env.local|run \`pnpm --filter=@feel-good/convex dev\` once in main to let the Convex CLI seed it"
)

MISSING=()
for entry in "${REQUIRED_ENVS[@]}"; do
  rel="${entry%%|*}"
  [[ -f "$MAIN_ROOT/$rel" ]] || MISSING+=("$entry")
done

if (( ${#MISSING[@]} > 0 )); then
  echo "Error: required .env.local files are missing from the main checkout:" >&2
  for entry in "${MISSING[@]}"; do
    rel="${entry%%|*}"
    hint="${entry#*|}"
    echo "  $rel" >&2
    echo "    seed: $hint" >&2
  done
  exit 1
fi

if [[ "$CHECK_ONLY" == true ]]; then
  echo "Canonical .env.local files are present in $MAIN_ROOT."
  exit 0
fi

if [[ "$CURRENT_ROOT" != "$MAIN_ROOT" ]]; then
  echo "Linking .env.local files from $MAIN_ROOT..."

  for entry in "${REQUIRED_ENVS[@]}"; do
    rel="${entry%%|*}"
    src="$MAIN_ROOT/$rel"
    dest="$CURRENT_ROOT/$rel"

    mkdir -p "$(dirname "$dest")"

    if [[ -e "$dest" && ! -L "$dest" ]]; then
      echo "Error: $rel already exists and is not a symlink; refusing to overwrite it." >&2
      exit 1
    fi

    ln -sfn "$src" "$dest"
    echo "  Linked $rel"
  done
else
  echo "Running in the main checkout; canonical .env.local files are already present."
fi

pnpm install --frozen-lockfile --prefer-offline --reporter=append-only
