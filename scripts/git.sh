#!/bin/sh
# Codex includes Git on Macs without Xcode Command Line Tools.
set -eu
PROJECT_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$PROJECT_ROOT"
CODEX_GIT="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback/git"
if [ -x "$CODEX_GIT" ]; then
  exec "$CODEX_GIT" "$@"
fi
exec git "$@"
