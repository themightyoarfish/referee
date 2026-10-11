#!/usr/bin/env bash
# Build Referee.app for macOS (run on macOS).
# Bundles: Node server + production build of the React web UI (client/).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
APP_NAME="Referee.app"
BUILD_DIR="$ROOT/build/macos"
APP_DIR="$BUILD_DIR/$APP_NAME"
RES="$APP_DIR/Contents/Resources"
NODE_VERSION="18.18.2"
ARCH="$(uname -m)"
case "$ARCH" in
  arm64) NODE_ARCH="arm64" ;;
  x86_64) NODE_ARCH="x64" ;;
  *) echo "Unsupported arch: $ARCH"; exit 1 ;;
esac

echo "==> Install dependencies and build web UI"
cd "$ROOT/client"
npm clean-install
npm run build

echo "==> Install server dependencies (production)"
cd "$ROOT/server"
npm clean-install --omit=dev

echo "==> Prepare app bundle"
rm -rf "$APP_DIR"
mkdir -p "$APP_DIR/Contents/MacOS" "$RES/node" "$RES/macos-scripts" "$RES/server" "$RES/client"

echo "==> Download Node.js $NODE_VERSION"
NODE_TAR="node-v${NODE_VERSION}-darwin-${NODE_ARCH}.tar.gz"
NODE_URL="https://nodejs.org/dist/v${NODE_VERSION}/${NODE_TAR}"
TMP_NODE="$BUILD_DIR/$NODE_TAR"
if [[ ! -f "$TMP_NODE" ]]; then
  curl -fsSL "$NODE_URL" -o "$TMP_NODE"
fi
tar -xzf "$TMP_NODE" -C "$BUILD_DIR"
cp -R "$BUILD_DIR/node-v${NODE_VERSION}-darwin-${NODE_ARCH}/bin" "$RES/node/"
cp -R "$BUILD_DIR/node-v${NODE_VERSION}-darwin-${NODE_ARCH}/lib" "$RES/node/" 2>/dev/null || true

echo "==> Copy application files"
cp -R "$ROOT/server/"* "$RES/server/"
rm -rf "$RES/server/node_modules"
cd "$ROOT/server"
npm clean-install --omit=dev
cp -R node_modules "$RES/server/node_modules"
if [[ ! -d "$ROOT/client/build" ]]; then
  echo "Missing $ROOT/client/build — run: (cd client && npm run build)"
  exit 1
fi
mkdir -p "$RES/client"
cp -R "$ROOT/client/build" "$RES/client/"

cp "$ROOT/packaging/macos/Referee.launcher.sh" "$APP_DIR/Contents/MacOS/Referee"
cp "$ROOT/packaging/macos/run-setup.sh" "$RES/macos-scripts/"
cp "$ROOT/packaging/macos/keychain.sh" "$RES/macos-scripts/"
cp "$ROOT/packaging/macos/cleanup-stale-referee.sh" "$RES/macos-scripts/"
chmod +x "$APP_DIR/Contents/MacOS/Referee" "$RES/macos-scripts/"*.sh

echo "==> App icon (favicon.ico)"
chmod +x "$ROOT/packaging/macos/make-app-icon.sh"
"$ROOT/packaging/macos/make-app-icon.sh" "$ROOT/client/public/favicon.ico" "$RES/AppIcon.icns"

cat >"$APP_DIR/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>Referee</string>
  <key>CFBundleIdentifier</key>
  <string>de.referee.app</string>
  <key>CFBundleName</key>
  <string>Referee</string>
  <key>CFBundleIconFile</key>
  <string>AppIcon</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>2.0.1</string>
  <key>CFBundleVersion</key>
  <string>2.0.1</string>
  <key>LSMinimumSystemVersion</key>
  <string>11.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
  <key>LSMultipleInstancesProhibited</key>
  <true/>
</dict>
</plist>
PLIST

echo "==> Ad-hoc sign (optional)"
if command -v codesign >/dev/null 2>&1; then
  codesign --force --deep -s - "$APP_DIR" 2>/dev/null || true
fi

echo "Built: $APP_DIR"
echo "Copy to Applications and double-click Referee.app"
