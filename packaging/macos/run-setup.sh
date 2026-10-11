#!/usr/bin/env bash
# First-run admin + network picker (network on every launch).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=packaging/macos/keychain.sh
source "$SCRIPT_DIR/keychain.sh"

NODE="${REFEREE_NODE:-node}"
HOST_CLI="${REFEREE_HOST_CLI:-$SCRIPT_DIR/../../server/scripts/referee-host.js}"
MODE="${1:-full}"

random_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  else
    "$NODE" -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  fi
}

run_admin_setup() {
  if kc_has_admin && kc_has_jwt; then
    return 0
  fi

  local user pass
  user="$(osascript -e 'display dialog "Admin-Benutzername für Referee (min. 4 Zeichen):" default answer "admin" with title "Referee Einrichtung"' -e 'text returned of result' 2>/dev/null || true)"
  [[ -z "$user" ]] && exit 1
  pass="$(osascript -e 'display dialog "Admin-Passwort (min. 6 Zeichen):" default answer "" with hidden answer with title "Referee Einrichtung"' -e 'text returned of result' 2>/dev/null || true)"
  [[ -z "$pass" ]] && exit 1

  kc_set "admin-username" "$user"
  kc_set "admin-password" "$pass"
  kc_set "jwt-secret" "$(random_secret)"
}

pick_network_address() {
  local lines=()
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    lines+=("$line")
  done < <("$NODE" "$HOST_CLI" list)

  if [[ ${#lines[@]} -eq 0 ]]; then
    osascript -e 'display alert "Referee" message "Keine Netzwerkadresse gefunden. Bitte mit WLAN oder Ethernet verbinden."' >/dev/null 2>&1 || true
    exit 1
  fi

  local displays=() addresses=()
  local row display rest addr
  for row in "${lines[@]}"; do
    display="${row%%$'\t'*}"
    rest="${row#*$'\t'}"
    addr="${rest%%$'\t'*}"
    displays+=("$display")
    addresses+=("$addr")
  done

  local as_list=""
  local d esc
  for d in "${displays[@]}"; do
    esc="${d//\\/\\\\}"
    esc="${esc//\"/\\\"}"
    as_list="${as_list}\"${esc}\", "
  done
  as_list="${as_list%, }"

  local choice
  choice="$(osascript -e "choose from list {${as_list}} with title \"Referee\" with prompt \"Adresse für Kampfrichter-Handys und QR-Codes:\"" 2>/dev/null || true)"

  if [[ -z "$choice" || "$choice" == "false" ]]; then
    exit 1
  fi

  local i
  for i in "${!displays[@]}"; do
    if [[ "${displays[$i]}" == "$choice" ]]; then
      export HOST_IP="${addresses[$i]}"
      return 0
    fi
  done
  exit 1
}

if [[ "$MODE" == "network" ]]; then
  pick_network_address
  echo "$HOST_IP"
  exit 0
fi

if [[ "$MODE" == "admin" ]]; then
  run_admin_setup
  exit 0
fi

run_admin_setup
pick_network_address
echo "$HOST_IP"
