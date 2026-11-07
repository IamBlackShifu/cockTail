#!/usr/bin/env bash
# Build before replacing the running container; restore its image if startup fails.
set -Eeuo pipefail
[[ $EUID -eq 0 ]] || { echo "Run as root." >&2; exit 1; }
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
command -v docker >/dev/null || { echo "Run setup-server.sh first." >&2; exit 1; }
exec 9>/var/lock/tipsygo-deploy.lock
flock -n 9 || { echo "Another deployment is running." >&2; exit 1; }
docker compose config --quiet

previous_image=""
container_id="$(docker compose ps -q app)"
if [[ -n "$container_id" ]]; then
  previous_image="$(docker inspect --format '{{.Image}}' "$container_id")"
  docker tag "$previous_image" tipsygo:previous
  if docker compose exec -T app test -f /app/data/orders.sqlite; then
    bash deploy/backup-orders.sh
  fi
fi

if docker compose build --pull app; then
  :
else
  build_status=$?
  echo "Build failed; the running application has not been replaced." >&2
  echo "If the build output reports exit code 137, check for memory exhaustion:"
  free -h
  swapon --show
  echo "Kernel evidence: journalctl -k -n 300 --no-pager | grep -Ei 'oom|out of memory|killed process'"
  echo "For low-memory builds, run: bash deploy/recover-build.sh '$PWD'"
  exit "$build_status"
fi
if ! docker compose up -d --no-build --wait --wait-timeout 120; then
  docker compose logs --tail=100 app
  if [[ -n "$previous_image" ]]; then
    echo "New container failed health checks; restoring the previous image." >&2
    docker tag "$previous_image" tipsygo:local
    docker compose up -d --no-build --wait --wait-timeout 120
  fi
  exit 1
fi

curl --fail --silent --show-error --max-time 15 -o /dev/null http://127.0.0.1:3000/
curl --fail --silent --show-error --max-time 15 -o /dev/null http://127.0.0.1:3000/ops
docker compose ps
echo "Application is healthy."
