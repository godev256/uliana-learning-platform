#!/bin/bash
set -euo pipefail
umask 077
[[ $# == 1 && "$1" =~ ^[0-9a-f]{40}$ ]] || { echo 'Expected one full commit SHA' >&2; exit 64; }
cd /opt/ulianaa
exec 9>/run/lock/ulianaa-deploy.lock
flock -w 300 9
# Configuration is root-owned; CI may select an image tag, never modify compose.
set -a
. /opt/ulianaa/.env
set +a
previous=${IMAGE_TAG:-}
export IMAGE_TAG=$1
# The Actions job supplies its short-lived, read-only GHCR token over SSH stdin.
# No long-lived registry PAT is retained on the host.
auth=$(head -c 65536)
if [[ -n "$auth" ]]; then
  registry_user=$(jq -er '.username | select(type=="string" and length>0)' <<< "$auth")
  registry_token=$(jq -er '.token | select(type=="string" and length>0)' <<< "$auth")
  export DOCKER_CONFIG
  DOCKER_CONFIG=$(mktemp -d /run/ulianaa-registry.XXXXXX)
  trap 'rm -rf "$DOCKER_CONFIG"' EXIT
  printf '%s' "$registry_token" | docker login ghcr.io --username "$registry_user" --password-stdin >/dev/null
  unset auth registry_token
fi
compose=(docker compose --env-file /opt/ulianaa/.env -f /opt/ulianaa/compose.yaml)
"${compose[@]}" pull api caddy
if ! "${compose[@]}" up -d --wait --wait-timeout 180; then
  echo 'Deployment failed; restoring the previous release' >&2
  if [[ "$previous" =~ ^[0-9a-f]{40}$ && "$previous" != "$IMAGE_TAG" ]]; then
    export IMAGE_TAG=$previous
    "${compose[@]}" up -d --wait --wait-timeout 180
  fi
  exit 1
fi
# Check HTTP readiness inside the isolated API network as well as Docker health.
"${compose[@]}" exec -T api wget -q -O /dev/null http://127.0.0.1:8081/readyz
sed -E "s/^IMAGE_TAG=.*/IMAGE_TAG=$IMAGE_TAG/" .env > .env.next
chmod 600 .env.next
mv .env.next .env
printf '%s %s\n' "$(date -u +%FT%TZ)" "$IMAGE_TAG" >> /var/log/ulianaa/deployments.log
"${compose[@]}" ps
echo "Deployed $IMAGE_TAG"
