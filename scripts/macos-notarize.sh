#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_PATH="$ROOT_DIR/apps/desktop/src-tauri/target/release/bundle/macos/BnsStudio.app"
DMG_PATH="$ROOT_DIR/apps/desktop/src-tauri/target/release/bundle/dmg/BnsStudio_1.1.0_aarch64.dmg"

required() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Variabile richiesta mancante: $name" >&2
    exit 1
  fi
}

required APPLE_ID
required APPLE_TEAM_ID
required APPLE_APP_SPECIFIC_PASSWORD

if [[ ! -d "$APP_PATH" || ! -f "$DMG_PATH" ]]; then
  echo "Bundle non trovato. Esegui prima: npm run build:desktop" >&2
  exit 1
fi

if [[ -n "${APPLE_SIGNING_IDENTITY:-}" ]]; then
  echo "Firmo BnsStudio.app con identita': $APPLE_SIGNING_IDENTITY"
  codesign \
    --force \
    --deep \
    --options runtime \
    --timestamp \
    --sign "$APPLE_SIGNING_IDENTITY" \
    "$APP_PATH"

  echo "Verifico firma app"
  codesign --verify --deep --strict --verbose=2 "$APP_PATH"

  echo "Firmo il DMG"
  codesign \
    --force \
    --timestamp \
    --sign "$APPLE_SIGNING_IDENTITY" \
    "$DMG_PATH"
else
  echo "APPLE_SIGNING_IDENTITY non impostata: salto la firma locale e provo la notarization del DMG esistente."
fi

echo "Invio DMG ad Apple Notary Service"
xcrun notarytool submit "$DMG_PATH" \
  --apple-id "$APPLE_ID" \
  --team-id "$APPLE_TEAM_ID" \
  --password "$APPLE_APP_SPECIFIC_PASSWORD" \
  --wait

echo "Staple ticket notarization"
xcrun stapler staple "$APP_PATH" || true
xcrun stapler staple "$DMG_PATH"

echo "Verifica Gatekeeper"
spctl --assess --type execute --verbose "$APP_PATH"
spctl --assess --type open --verbose "$DMG_PATH"

echo "BnsStudio firmato/notarizzato: $DMG_PATH"
