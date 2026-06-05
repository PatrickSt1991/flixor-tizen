#!/usr/bin/env bash
#
# build-wgt.sh — build a signed Flixor .wgt for Samsung Tizen TV.
#
# Requires on PATH: node (18+), npm, and the Tizen Studio CLI (`tizen`)
# with the TV extension + a signing profile created in Certificate Manager.
#
# Usage:
#   scripts/build-wgt.sh <cert-profile>
#   TIZEN_PROFILE=<cert-profile> scripts/build-wgt.sh
#
# List profiles with:  tizen security-profiles list
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$ROOT/apps/tizen"
DIST="$APP_DIR/dist"
PROFILE="${TIZEN_PROFILE:-${1:-}}"

if [ -z "$PROFILE" ]; then
  echo "error: no signing profile given." >&2
  echo "usage: TIZEN_PROFILE=<profile> $0   (or: $0 <profile>)" >&2
  echo "       tizen security-profiles list" >&2
  exit 1
fi

command -v tizen >/dev/null 2>&1 || {
  echo "error: 'tizen' CLI not found. Install Tizen Studio CLI + TV extension." >&2
  exit 1
}

cd "$ROOT"

# Scoped install: only the two workspaces the TV app needs. Avoids pulling the
# mobile (Expo/React-Native) and macOS workspaces, which are large and native.
echo ">> Installing deps (@flixor/core + flixor-tizen)"
npm install --ignore-scripts \
  --workspace=@flixor/core \
  --workspace=flixor-tizen \
  --include-workspace-root

echo ">> Building @flixor/core (workspace dependency)"
npm run build:core

echo ">> Building Tizen web bundle (vite + legacy transpile)"
npm run build -w flixor-tizen

# Vite emits config.xml, icon.png and index.html at the dist root (base: './'),
# so the dist dir is already a valid Tizen web-app package source.
echo ">> Packaging signed .wgt (profile: $PROFILE)"
tizen package -t wgt -s "$PROFILE" -o "$DIST" -- "$DIST"

WGT="$(ls -t "$DIST"/*.wgt 2>/dev/null | head -1)"
echo ""
echo ">> Built: $WGT"
echo "   Install on a dev-mode TV:"
echo "     sdb connect <tv-ip>:26101"
echo "     tizen install -n \"$(basename "$WGT")\" -- \"$DIST\""
