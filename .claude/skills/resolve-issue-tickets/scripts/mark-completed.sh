#!/usr/bin/env bash
# Atomically close one or more tickets: flip frontmatter status: to-do → completed
# and git-mv the file from to-do/ to completed/. All-or-nothing.
#
# Usage:
#   mark-completed.sh FG_209 FG_213 FG_220
#   mark-completed.sh FG_209-p1-validate-contact-hostname-kind.md
#
# Exit codes:
#   0  all tickets transitioned successfully
#   1  one or more inputs failed validation; nothing changed
#   2  invoked from outside a git worktree
#
# Designed for the resolve-issue-tickets skill — replaces the ad-hoc
# `for f in …; sed; mv` loops that have dropped tickets in past sessions
# (pr-93 forgot FG_206; beijing committed code without moving the ticket).

set -euo pipefail

if [[ $# -eq 0 ]]; then
  echo "usage: mark-completed.sh <ticket-id|filename> [...]" >&2
  exit 1
fi

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || true)
if [[ -z "$REPO_ROOT" ]]; then
  echo "error: not inside a git worktree" >&2
  exit 2
fi

TODO_DIR="$REPO_ROOT/workspace/tickets/to-do"
DONE_DIR="$REPO_ROOT/workspace/tickets/completed"

if [[ ! -d "$TODO_DIR" ]]; then
  echo "error: $TODO_DIR not found" >&2
  exit 1
fi
mkdir -p "$DONE_DIR"

# Resolve every input to a path in to-do/ before touching anything.
declare -a PATHS=()
declare -a IDS=()
FAIL=0
for arg in "$@"; do
  # Accept either FG_NNN or the full filename
  case "$arg" in
    FG_[0-9][0-9][0-9])
      match=$(find "$TODO_DIR" -maxdepth 1 -type f -name "${arg}-*.md" 2>/dev/null | head -1)
      ;;
    *.md)
      match="$TODO_DIR/$(basename "$arg")"
      [[ -f "$match" ]] || match=""
      ;;
    *)
      echo "skip: '$arg' is not a valid ticket id (FG_NNN) or .md filename" >&2
      FAIL=1
      continue
      ;;
  esac

  if [[ -z "$match" || ! -f "$match" ]]; then
    echo "skip: no file in to-do/ matches '$arg'" >&2
    FAIL=1
    continue
  fi

  # Frontmatter must read `status: to-do` — protect against double-close
  if ! grep -q '^status: to-do$' "$match"; then
    actual=$(grep -m1 '^status:' "$match" || echo 'status: <missing>')
    echo "skip: $(basename "$match") has '$actual' (expected 'status: to-do')" >&2
    FAIL=1
    continue
  fi

  PATHS+=("$match")
  # Pull the ID for the report
  id=$(grep -m1 '^id:' "$match" | sed -E 's/^id: *//; s/^"//; s/"$//')
  IDS+=("$id")
done

if [[ $FAIL -ne 0 ]]; then
  echo "aborted: $FAIL input(s) failed validation; no files modified" >&2
  exit 1
fi

if [[ ${#PATHS[@]} -eq 0 ]]; then
  echo "nothing to do" >&2
  exit 1
fi

# Phase 2: apply. sed -i differs on mac vs gnu; use a portable form via temp file.
for path in "${PATHS[@]}"; do
  tmp="${path}.tmp.$$"
  awk 'BEGIN{done=0} /^status: to-do$/ && !done {print "status: completed"; done=1; next} {print}' "$path" > "$tmp"
  mv "$tmp" "$path"
done

# Phase 3: git mv each. `git mv` keeps history; falls back to plain mv if file
# isn't tracked yet (newly-created ticket in the same session).
for i in "${!PATHS[@]}"; do
  src="${PATHS[$i]}"
  dest="$DONE_DIR/$(basename "$src")"
  if git -C "$REPO_ROOT" ls-files --error-unmatch -- "$src" >/dev/null 2>&1; then
    git -C "$REPO_ROOT" mv "$src" "$dest"
  else
    mv "$src" "$dest"
  fi
  echo "completed: ${IDS[$i]}  ($(basename "$dest"))"
done

echo "done: ${#PATHS[@]} ticket(s) moved to completed/"
