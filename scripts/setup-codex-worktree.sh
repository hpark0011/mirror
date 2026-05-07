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

STANDALONE_CHECKOUT=false
MAIN_ROOT="${MIRROR_CANONICAL_ROOT:-}"
if [[ -z "$MAIN_ROOT" ]]; then
  MAIN_ROOT=$(find_main_root || true)
fi

if [[ -z "$MAIN_ROOT" ]]; then
  MAIN_ROOT="$CURRENT_ROOT"
  STANDALONE_CHECKOUT=true
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
  if [[ "$CHECK_ONLY" == true || "$CURRENT_ROOT" != "$MAIN_ROOT" ]]; then
    echo "Error: required .env.local files are missing from the main checkout:" >&2
    for entry in "${MISSING[@]}"; do
      rel="${entry%%|*}"
      hint="${entry#*|}"
      echo "  $rel" >&2
      echo "    seed: $hint" >&2
    done
    echo "Set MIRROR_CANONICAL_ROOT to the main checkout path if it could not be detected." >&2
    exit 1
  fi

  echo "Warning: local .env.local files are missing in this standalone checkout:" >&2
  for entry in "${MISSING[@]}"; do
    rel="${entry%%|*}"
    hint="${entry#*|}"
    echo "  $rel" >&2
    echo "    seed: $hint" >&2
  done
  echo "Continuing with dependency install; app/Convex actions may need env setup before they run." >&2
fi

if [[ "$CHECK_ONLY" == true ]]; then
  if [[ "$STANDALONE_CHECKOUT" == true ]]; then
    echo "Local .env.local files are present in $MAIN_ROOT."
  else
    echo "Canonical .env.local files are present in $MAIN_ROOT."
  fi
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
  if [[ "$STANDALONE_CHECKOUT" == true ]]; then
    echo "Running in a standalone checkout; no .env.local symlinks needed."
  else
    echo "Running in the main checkout; canonical .env.local files are already present."
  fi
fi

pnpm install --frozen-lockfile --prefer-offline --reporter=append-only
