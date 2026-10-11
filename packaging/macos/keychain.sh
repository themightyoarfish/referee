#!/usr/bin/env bash
# Keychain helpers for Referee.app (service: de.referee.app)
set -euo pipefail

SERVICE="de.referee.app"

kc_get() {
  local account="$1"
  security find-generic-password -s "$SERVICE" -a "$account" -w 2>/dev/null || true
}

kc_set() {
  local account="$1"
  local value="$2"
  if kc_get "$account" | grep -q .; then
    security delete-generic-password -s "$SERVICE" -a "$account" >/dev/null 2>&1 || true
  fi
  security add-generic-password -s "$SERVICE" -a "$account" -w "$value" -U >/dev/null
}

kc_has_admin() {
  local u p
  u="$(kc_get admin-username)"
  p="$(kc_get admin-password)"
  [[ -n "$u" && -n "$p" ]]
}

kc_has_jwt() {
  [[ -n "$(kc_get jwt-secret)" ]]
}
