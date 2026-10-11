#!/usr/bin/env bash
# Build AppIcon.icns for Referee.app from client/public/favicon.ico (macOS only).
set -euo pipefail

ICO="${1:?usage: make-app-icon.sh <favicon.ico> <output.icns>}"
OUT="${2:?usage: make-app-icon.sh <favicon.ico> <output.icns>}"

if [[ ! -f "$ICO" ]]; then
  echo "Missing favicon: $ICO"
  exit 1
fi

OUT_DIR="$(cd "$(dirname "$OUT")" && pwd)"
WORKDIR="$(mktemp -d "$OUT_DIR/.icon-build.XXXXXX")"
trap 'rm -rf "$WORKDIR"' EXIT

ICONSET="$WORKDIR/AppIcon.iconset"
mkdir -p "$ICONSET"

MASTER="$WORKDIR/master.png"
sips -s format png "$ICO" --out "$MASTER" >/dev/null

for size in 16 32 128 256 512; do
  sips -z "$size" "$size" "$MASTER" --out "$ICONSET/icon_${size}x${size}.png" >/dev/null
  s2=$((size * 2))
  sips -z "$s2" "$s2" "$MASTER" --out "$ICONSET/icon_${size}x${size}@2x.png" >/dev/null
done

iconutil -c icns "$ICONSET" -o "$OUT_DIR/$(basename "$OUT")"
