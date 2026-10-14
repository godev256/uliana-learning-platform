#!/bin/sh
# Use the project's local Node.js installation, or a system installation.
set -eu
PROJECT_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
if [ -x "$PROJECT_ROOT/.local/node/bin/node" ]; then
  PATH="$PROJECT_ROOT/.local/node/bin:$PATH"
fi
export PATH
npm_config_cache=${npm_config_cache:-"$PROJECT_ROOT/.local/npm-cache"}
export npm_config_cache
PLAYWRIGHT_BROWSERS_PATH=${PLAYWRIGHT_BROWSERS_PATH:-"$PROJECT_ROOT/.local/playwright"}
export PLAYWRIGHT_BROWSERS_PATH
if ! command -v npm >/dev/null 2>&1; then
  echo 'Нужен Node.js 24 с npm. Установите Node.js или выполните nvm install в папке проекта.' >&2
  exit 1
fi
cd "$PROJECT_ROOT"
exec npm "$@"
