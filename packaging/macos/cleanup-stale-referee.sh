#!/usr/bin/env bash
# Stop Referee completely so you can relaunch or delete Referee.app (run in Terminal).
set -euo pipefail
DATA_DIR="${HOME}/Library/Application Support/Referee"
PID_FILE="$DATA_DIR/referee.pid"
LOCK_DIR="$DATA_DIR/referee.launcher.lock.d"
LEGACY_LOCK_FILE="$DATA_DIR/referee.launcher.lock"
PORT="${PORT:-3030}"

echo "Stopping Referee launcher (if any)..."
# macOS Launch Services keeps the .app "open" while these processes run.
pkill -f "/Applications/Referee.app/Contents/MacOS/Referee" 2>/dev/null || true
pkill -f "Referee.app/Contents/Resources/node/bin/node app.js" 2>/dev/null || true

echo "Stopping listener on port ${PORT}..."
pids="$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null || true)"
if [[ -n "$pids" ]]; then
  kill $pids 2>/dev/null || true
  sleep 1
  pids="$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    kill -9 $pids 2>/dev/null || true
  fi
fi

if [[ -f "$PID_FILE" ]]; then
  pid="$(cat "$PID_FILE")"
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
    sleep 1
    kill -9 "$pid" 2>/dev/null || true
  fi
fi

rm -f "$PID_FILE" "$LEGACY_LOCK_FILE"
rm -rf "$LOCK_DIR"
echo "Done. Port ${PORT} should be free; you can quit/delete Referee.app or open it again."
