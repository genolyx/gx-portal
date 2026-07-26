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

case "$MODE" in
  --down)
    echo "==> Prod: stopping stack"
    docker compose down
    echo "Production stopped."
    ;;
  --restart)
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
    echo "==> Prod: docker compose up -d --build --force-recreate"
    # --force-recreate ensures new images replace crash-looping containers
    docker compose up -d --build --force-recreate
    docker compose ps
    echo
    echo "Production: http://localhost:8090"
    echo "Logs: docker compose logs -f --tail=100"
    ;;
esac
