#!/usr/bin/env bash
set -euo pipefail

RESOURCES="$(cd "$(dirname "$0")/../Resources" && pwd)"
DATA_DIR="${HOME}/Library/Application Support/Referee"
LOG_DIR="$DATA_DIR/logs"
PID_FILE="$DATA_DIR/referee.pid"
LOCK_DIR="$DATA_DIR/referee.launcher.lock.d"
LAUNCHER_LOCK_DIR=""
LOG_FILE="$LOG_DIR/referee.log"
PORT="${PORT:-3030}"

NODE_BIN="$RESOURCES/node/bin/node"
SERVER_DIR="$RESOURCES/server"
HOST_CLI="$SERVER_DIR/scripts/referee-host.js"
SETUP_SH="$RESOURCES/macos-scripts/run-setup.sh"

mkdir -p "$DATA_DIR" "$LOG_DIR" "$DATA_DIR/database"

export REFEREE_DATA_DIR="$DATA_DIR"
export REFEREE_SECRETS=keychain
export REFEREE_APP_BUNDLE=1
export REFEREE_NODE="$NODE_BIN"
export REFEREE_HOST_CLI="$HOST_CLI"

if [[ ! -x "$NODE_BIN" ]]; then
  NODE_BIN="$(command -v node || true)"
fi
if [[ -z "$NODE_BIN" || ! -x "$NODE_BIN" ]]; then
  osascript -e 'display alert "Referee" message "Node.js fehlt in der App."' 2>/dev/null || true
  exit 1
fi

on_exit() {
  release_launcher_lock
}
trap on_exit EXIT INT TERM

release_launcher_lock() {
  if [[ -n "$LAUNCHER_LOCK_DIR" && -d "$LAUNCHER_LOCK_DIR" ]]; then
    rm -rf "$LAUNCHER_LOCK_DIR"
    LAUNCHER_LOCK_DIR=""
  fi
}

acquire_launcher_lock() {
  if mkdir "$LOCK_DIR" 2>/dev/null; then
    echo $$ >"$LOCK_DIR/pid"
    LAUNCHER_LOCK_DIR="$LOCK_DIR"
    return 0
  fi

  local holder=""
  if [[ -f "$LOCK_DIR/pid" ]]; then
    holder="$(cat "$LOCK_DIR/pid")"
  fi
  if [[ -n "$holder" ]] && kill -0 "$holder" 2>/dev/null; then
    sleep 1
    if [[ -n "$holder" ]] && kill -0 "$holder" 2>/dev/null; then
      osascript -e 'display alert "Referee" message "Referee wird gerade gestartet. Bitte einige Sekunden warten und erneut öffnen."' 2>/dev/null || true
      exit 0
    fi
  fi

  rm -rf "$LOCK_DIR"
  mkdir "$LOCK_DIR"
  echo $$ >"$LOCK_DIR/pid"
  LAUNCHER_LOCK_DIR="$LOCK_DIR"
}

listener_pid() {
  lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null | head -1 || true
}

server_is_running() {
  local lp
  lp="$(listener_pid)"
  [[ -n "$lp" ]]
}

force_stop_server() {
  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid="$(cat "$PID_FILE")"
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      sleep 1
      kill -9 "$pid" 2>/dev/null || true
    fi
    rm -f "$PID_FILE"
  fi

  local lp
  lp="$(listener_pid)"
  if [[ -n "$lp" ]]; then
    kill "$lp" 2>/dev/null || true
    sleep 1
    kill -9 "$lp" 2>/dev/null || true
  fi
  rm -f "$PID_FILE"
}

prompt_launch_choice() {
  local status_msg
  if server_is_running; then
    status_msg="Status: Der Server läuft gerade (Port ${PORT})."
  else
    status_msg="Status: Der Server läuft nicht."
  fi

  osascript <<EOF 2>/dev/null || echo "Abbrechen"
set msg to "Referee startet oder beendet den Kampfrichter-Server auf diesem Rechner.

Server beenden: Referee erneut starten und \"Server beenden\" wählen.

${status_msg}

\"Server starten\" startet den Server neu (ein laufender Server wird dabei beendet)."

set choice to button returned of (display dialog msg buttons {"Abbrechen", "Server beenden", "Server starten"} default button "Server starten" with title "Referee" with icon note)

choice
EOF
}

start_server() {
  force_stop_server

  if ! HOST_IP="$(
    REFEREE_NODE="$NODE_BIN" REFEREE_HOST_CLI="$HOST_CLI" bash "$SETUP_SH" full
  )"; then
    osascript -e 'display alert "Referee" message "Einrichtung abgebrochen."' 2>/dev/null || true
    return 1
  fi
  export HOST_IP

  cd "$SERVER_DIR"
  nohup "$NODE_BIN" app.js >>"$LOG_FILE" 2>&1 &
  local server_pid=$!
  echo "$server_pid" >"$PID_FILE"

  sleep 2
  if ! kill -0 "$server_pid" 2>/dev/null; then
    rm -f "$PID_FILE"
    osascript -e 'display alert "Referee" message "Server konnte nicht gestartet werden. Siehe Log in ~/Library/Application\ Support/Referee/logs."' 2>/dev/null || true
    tail -20 "$LOG_FILE" 2>/dev/null || true
    return 1
  fi

  open "http://127.0.0.1:${PORT}/settings"
  osascript -e "display notification \"http://${HOST_IP}:${PORT}\" with title \"Referee\" subtitle \"Server läuft. Beenden: Referee erneut starten.\"" 2>/dev/null || true
  return 0
}

acquire_launcher_lock

choice="$(prompt_launch_choice)"
case "$choice" in
  "Server beenden")
    force_stop_server
    osascript -e 'display notification "Der Kampfrichter-Server wurde beendet." with title "Referee"' 2>/dev/null || true
    ;;
  "Server starten")
    start_server || exit 1
    ;;
  *)
    ;;
esac

exit 0
