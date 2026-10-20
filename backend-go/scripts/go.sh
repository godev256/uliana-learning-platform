#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
export GOTELEMETRY=off
export GOCACHE="$ROOT/.local/go-build"
mkdir -p "$GOCACHE"
if command -v go >/dev/null 2>&1; then GO=$(command -v go); else GO="$ROOT/../.local/toolchains/go/bin/go"; fi
cd "$ROOT"
exec "$GO" "$@"
