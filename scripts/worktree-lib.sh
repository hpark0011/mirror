#!/bin/bash

worktree_realpath() {
  local target="$1"
  cd "$target" && pwd -P
}

worktree_git_root() {
  local root
  root=$(git rev-parse --show-toplevel)
  worktree_realpath "$root"
}

worktree_find_main_root() {
  if [[ -n "${MIRROR_CANONICAL_ROOT:-}" ]]; then
    worktree_realpath "$MIRROR_CANONICAL_ROOT"
    return 0
  fi

  local current=""
  while IFS= read -r line; do
    case "$line" in
      worktree\ *)
        current="${line#worktree }"
        ;;
      branch\ refs/heads/main)
        worktree_realpath "$current"
        return 0
        ;;
    esac
  done < <(git worktree list --porcelain)

  return 1
}

worktree_read_convex_deployment() {
  local env_file="$1"
  if [[ ! -f "$env_file" ]]; then
    return 0
  fi

  sed -nE 's/^CONVEX_DEPLOYMENT="?([^" #]+)"?.*/\1/p' "$env_file" | head -n1
}

worktree_slugify() {
  local raw="$1"
  local slug
  slug=$(printf "%s" "$raw" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//; s/-+/-/g' \
    | cut -c 1-50 \
    | sed -E 's/-+$//')

  if [[ -n "$slug" ]]; then
    printf "%s" "$slug"
    return 0
  fi

  printf "worktree-%s" "$(printf "%s" "$raw" | shasum -a 256 | cut -c 1-8)"
}

worktree_fallback_name() {
  local root="$1"

  if [[ "$root" == */.codex/worktrees/* ]]; then
    local rest="${root#*/.codex/worktrees/}"
    printf "codex-%s" "${rest%%/*}"
    return 0
  fi

  if [[ "$root" == */.worktrees/* ]]; then
    local rest="${root#*/.worktrees/}"
    printf "%s" "${rest%%/*}"
    return 0
  fi

  if [[ "$root" == */conductor/workspaces/* ]]; then
    printf "conductor-%s" "$(basename "$root")"
    return 0
  fi

  basename "$root"
}

worktree_deployment_name() {
  local root="$1"
  local raw
  raw=$(git -C "$root" branch --show-current 2>/dev/null || true)

  if [[ -z "$raw" ]]; then
    raw=$(worktree_fallback_name "$root")
  fi

  worktree_slugify "$raw"
}
