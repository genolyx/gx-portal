#!/usr/bin/env bash
# Restart Gx-Portal Web (Next.js) in the background — local development (:3000).
# Usage: ./run_dev.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
PORT="${PORT:-3000}"
RUN_DIR="$ROOT/.run"
LOG="$RUN_DIR/dev.log"
PIDFILE="$RUN_DIR/dev.pid"
NAME="gx-portal-web"

mkdir -p "$RUN_DIR"

kill_port() {
  local port="$1"
  local pids=""
  if command -v lsof >/dev/null 2>&1; then
    pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  elif command -v fuser >/dev/null 2>&1; then
    fuser -k "${port}/tcp" 2>/dev/null || true
    return 0
  fi
  if [[ -n "$pids" ]]; then
    echo "[$NAME] Stopping process(es) on port $port: $pids"
    # shellcheck disable=SC2086
    kill -TERM $pids 2>/dev/null || true
    sleep 1
    pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
    if [[ -n "$pids" ]]; then
      # shellcheck disable=SC2086
      kill -KILL $pids 2>/dev/null || true
    fi
  fi
}

kill_previous() {
  if [[ ! -f "$PIDFILE" ]]; then
    return 0
  fi
  local old
  old="$(cat "$PIDFILE" 2>/dev/null || true)"
  if [[ -z "$old" ]]; then
    rm -f "$PIDFILE"
    return 0
  fi
  if kill -0 "$old" 2>/dev/null; then
    echo "[$NAME] Stopping previous run (pid/pgid $old)"
    kill -TERM -- "-$old" 2>/dev/null || kill -TERM "$old" 2>/dev/null || true
    sleep 1
    kill -KILL -- "-$old" 2>/dev/null || kill -KILL "$old" 2>/dev/null || true
  fi
  rm -f "$PIDFILE"
}

echo "[$NAME] Restarting (port $PORT)…"
kill_previous
kill_port "$PORT"

cd "$ROOT"
: >"$LOG"
setsid pnpm run dev >>"$LOG" 2>&1 </dev/null &
echo $! >"$PIDFILE"

for _ in $(seq 1 60); do
  if lsof -tiTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "[$NAME] Running on http://localhost:$PORT (pid $(cat "$PIDFILE"))"
    echo "[$NAME] Log: $LOG"
    exit 0
  fi
  if ! kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
    echo "[$NAME] Failed to start. Last log lines:"
    tail -n 40 "$LOG" || true
    exit 1
  fi
  sleep 0.25
done

echo "[$NAME] Started (pid $(cat "$PIDFILE")) — port $PORT not open yet; check log:"
echo "  tail -f $LOG"
exit 0
