#!/usr/bin/env bash
# Open a markdown file in the Greyboard desktop app.
#
# Usage: open.sh <markdown-file-path>
#
# The path may be absolute or relative to the caller's $PWD. The script
# resolves it, validates the extension and existence, then launches
# Greyboard with the file. Greyboard's parseOpenFile() in
# src/main/open-file-argv.ts picks the path off argv on cold start;
# the `second-instance` handler in src/main/index.ts handles the case
# where Greyboard is already running.

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: open.sh <markdown-file-path>" >&2
  exit 1
fi

FILE_PATH="$1"

# Resolve to absolute path if a relative path was given.
if [[ "$FILE_PATH" != /* ]]; then
  FILE_PATH="$PWD/$FILE_PATH"
fi

# File must exist.
if [ ! -f "$FILE_PATH" ]; then
  echo "File not found: $FILE_PATH" >&2
  exit 1
fi

# Extension must be .md / .mdx / .markdown (matches MARKDOWN_EXTENSIONS_RE
# in src/main/open-file-argv.ts).
shopt -s nocasematch
if [[ ! "$FILE_PATH" =~ \.(md|mdx|markdown)$ ]]; then
  echo "Not a markdown file: $FILE_PATH" >&2
  exit 1
fi
shopt -u nocasematch

# Launch Greyboard with the file. `-a Greyboard` targets the installed app
# by name; the path becomes argv[1] inside the Electron main process.
open -a Greyboard "$FILE_PATH"

echo "Opened in Greyboard: $FILE_PATH"