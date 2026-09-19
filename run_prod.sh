#!/usr/bin/env bash
# Rebuild and restart production stack (Docker Compose → nginx :8090).
# Usage:
#   ./run_prod.sh           # rebuild images + up -d
#   ./run_prod.sh --restart # restart containers only (no rebuild)
#   ./run_prod.sh --down    # stop production stack
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker not found" >&2
  exit 1
fi

MODE="${1:-}"

# API image runs as uid/gid 1000 (node). Bind-mounted SQLite must be writable.
ensure_api_data_writable() {
  local data_dir="$ROOT/apps/api/data"
  mkdir -p "$data_dir"
  if chown -R 1000:1000 "$data_dir" 2>/dev/null; then
    echo "==> Ensured $data_dir owned by 1000:1000 (api container user)"
  elif sudo -n chown -R 1000:1000 "$data_dir" 2>/dev/null; then
    echo "==> Ensured $data_dir owned by 1000:1000 (via sudo)"
  else
    # Fallback when chown is not permitted: make SQLite files writable for uid 1000
    chmod u+rwX,go+rwX "$data_dir" 2>/dev/null || true
    for f in users.db users.db-shm users.db-wal portal.db; do
      [ -e "$data_dir/$f" ] && chmod go+rw "$data_dir/$f" 2>/dev/null || true
    done
    echo "==> Warning: could not chown $data_dir to 1000:1000; applied SQLite writable fallback" >&2
  fi
}

case "$MODE" in
  --down)
    echo "==> Prod: stopping stack"
    docker compose down
    echo "Production stopped."
    ;;
  --restart)
    ensure_api_data_writable
    echo "==> Prod: restarting containers (no rebuild)"
    docker compose restart
    docker compose ps
    echo
    echo "Production: http://localhost:8090"
    ;;
  ""|--build|*)
    if [[ -n "$MODE" && "$MODE" != "--build" ]]; then
      echo "Unknown option: $MODE" >&2
      echo "Usage: $0 [--build|--restart|--down]" >&2
      exit 1
    fi
    ensure_api_data_writable
    echo "==> Prod: docker compose up -d --build --force-recreate"
    # --force-recreate ensures new images replace crash-looping containers
    docker compose up -d --build --force-recreate
    docker compose ps
    echo
    echo "Production: http://localhost:8090"
    echo "Logs: docker compose logs -f --tail=100"
    ;;
esac
