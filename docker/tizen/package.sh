#!/usr/bin/env bash
#
# package.sh — runs inside the Tizen CLI container.
# Signs and packages a prebuilt web bundle (mounted at /work) into /output.
#
# Signing modes:
#   - If AUTHOR_P12_B64 is set, import that author cert (and DIST_P12_B64 if set,
#     e.g. your Samsung distributor cert) and sign with it. A wgt signed with your
#     Samsung distributor cert is the only kind that installs on a retail TV whose
#     DUID is enrolled in that cert.
#   - Otherwise generate an ephemeral Tizen author cert. The resulting wgt is fine
#     for the emulator and for validating the build, but will NOT install on a
#     retail Samsung TV — re-sign it locally with your Samsung profile first.
#
set -euo pipefail

SRC=/work          # prebuilt dist/ (config.xml at root)
OUT=/output
PROFILE=flixor
CERT_DIR=/home/tizen/certs
mkdir -p "$CERT_DIR" "$OUT"

if [ -n "${AUTHOR_P12_B64:-}" ]; then
  echo ">> Using provided signing certificate(s)"
  echo "$AUTHOR_P12_B64" | base64 -d > "$CERT_DIR/author.p12"
  ADD_ARGS=(-n "$PROFILE" -a "$CERT_DIR/author.p12" -p "${AUTHOR_P12_PASS:-}")
  if [ -n "${DIST_P12_B64:-}" ]; then
    echo "$DIST_P12_B64" | base64 -d > "$CERT_DIR/dist.p12"
    ADD_ARGS+=(-d "$CERT_DIR/dist.p12" -dp "${DIST_P12_PASS:-}")
  fi
  tizen security-profiles add "${ADD_ARGS[@]}"
else
  echo ">> No cert provided — generating an ephemeral author cert (emulator/validation only)"
  tizen certificate -a Flixor -p flixor -f author -- "$CERT_DIR"
  tizen security-profiles add -n "$PROFILE" -a "$CERT_DIR/author.p12" -p flixor
fi

echo ">> Packaging .wgt"
tizen package -t wgt -s "$PROFILE" -o "$OUT" -- "$SRC"

ls -la "$OUT"/*.wgt
