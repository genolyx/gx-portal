#!/bin/sh
# Fix bind-mounted /data permissions, then drop to node and start the API.
set -eu

if [ "$(id -u)" = "0" ]; then
  mkdir -p /data
  if ! chown -R node:node /data 2>/dev/null; then
    # Host-owned bind mount: make SQLite files/dir writable for node (uid 1000)
    chmod a+rwx /data 2>/dev/null || true
    for f in /data/users.db /data/users.db-shm /data/users.db-wal /data/portal.db; do
      [ -e "$f" ] && chmod a+rw "$f" 2>/dev/null || true
    done
  fi
  # Preserve CMD argv (e.g. node apps/api/dist/.../main.js)
  exec runuser -u node -- "$@"
fi

exec "$@"
