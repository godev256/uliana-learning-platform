#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"
if [ ! -f .env ]; then echo 'Create .env from .env.example and generate JWT_SECRET first.' >&2; exit 1; fi
set -a
. ./.env
set +a
case "${1:-api}" in
 db) exec ./scripts/go.sh run ./cmd/devdb ;;
 api) exec ./scripts/go.sh run ./cmd/api ;;
 test) export TEST_DATABASE_URL="$DATABASE_URL"; exec ./scripts/go.sh test -race ./... ;;
 *) echo 'Usage: ./scripts/dev.sh [db|api|test]' >&2; exit 1 ;;
esac
