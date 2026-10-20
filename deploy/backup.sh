#!/bin/bash
set -euo pipefail
umask 077
cd /opt/ulianaa
exec 9>/run/lock/ulianaa-backup.lock
flock -n 9 || exit 0
stamp=$(date -u +%Y%m%dT%H%M%SZ)
file="backups/postgres-$stamp.dump"
docker compose --env-file .env -f compose.yaml exec -T postgres pg_dump -U ulianaa -d ulianaa -Fc > "$file.tmp"
test -s "$file.tmp"
mv "$file.tmp" "$file"
find backups -maxdepth 1 -type f -name 'postgres-*.dump' -mtime +14 -delete
# Keep certificate/account/configuration state private in a separate backup.
cp .env "backups/runtime.env"
