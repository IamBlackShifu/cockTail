#!/usr/bin/env bash
# Produces a consistent SQLite snapshot, then copies it outside the Docker volume.
set -Eeuo pipefail
[[ $EUID -eq 0 ]] || { echo "Run as root." >&2; exit 1; }
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
exec 7>/var/lock/tipsygo-backup.lock
flock -n 7 || { echo "Another backup is running." >&2; exit 1; }
install -d -m 0700 /opt/tipsygo/backups
docker compose exec -T app node -e '
  const { DatabaseSync } = require("node:sqlite");
  const { unlinkSync, existsSync } = require("node:fs");
  const target = "/app/data/orders-backup.sqlite";
  if (existsSync(target)) unlinkSync(target);
  const db = new DatabaseSync(process.env.ORDER_DB_PATH);
  db.exec("PRAGMA busy_timeout = 5000");
  db.prepare("VACUUM INTO ?").run(target);
  db.close();
'
destination="/opt/tipsygo/backups/orders-$(date -u +%Y%m%dT%H%M%S%N).sqlite"
docker compose cp app:/app/data/orders-backup.sqlite "$destination"
chmod 0600 "$destination"
echo "Backup saved: $destination"
