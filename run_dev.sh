#!/usr/bin/env bash
# Restart local development stack (API :4000 + Web :3000) in the background.
# Usage: ./run_dev.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "==> Dev: API"
"$ROOT/apps/api/run_dev.sh"

echo "==> Dev: Web"
"$ROOT/apps/web/run_dev.sh"

echo
echo "Dev ready:"
echo "  Web  http://localhost:3000"
echo "  API  http://localhost:4000"
echo "  Logs apps/api/.run/dev.log  apps/web/.run/dev.log"
