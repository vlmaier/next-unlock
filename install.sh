#!/usr/bin/env sh
# Next Unlock — Zero-Prerequisite One-Command Installer & Updater for Steam Deck (Decky Loader)
#
# Usage on Steam Deck (Konsole / SSH):
#   curl -fsSL https://raw.githubusercontent.com/vlmaier/next-unlock/main/install.sh | sh
#
# Optional environment overrides:
#   NEXT_UNLOCK_REPO="vlmaier/next-unlock"
#   NEXT_UNLOCK_VERSION="latest"   # or e.g. "v1.3.2"
#   DECKY_PLUGINS_DIR="$HOME/homebrew/plugins"

set -eu

REPO="${NEXT_UNLOCK_REPO:-vlmaier/next-unlock}"
VERSION="${NEXT_UNLOCK_VERSION:-latest}"
PLUGINS_DIR="${DECKY_PLUGINS_DIR:-$HOME/homebrew/plugins}"
PLUGIN_NAME="next-unlock"
TARGET_DIR="${PLUGINS_DIR}/${PLUGIN_NAME}"
TMP_DIR="$(mktemp -d 2>/dev/null || mktemp -d -t 'next-unlock-install')"
ZIP_PATH="${TMP_DIR}/next-unlock.zip"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT INT TERM

echo "==> Next Unlock Installer & Updater (${VERSION})"

if [ "${VERSION}" = "latest" ]; then
  DOWNLOAD_URL="https://github.com/${REPO}/releases/latest/download/next-unlock.zip"
else
  DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${VERSION}/next-unlock.zip"
fi

echo "==> Downloading ${DOWNLOAD_URL} ..."
curl -fL --retry 3 --connect-timeout 15 -o "$ZIP_PATH" "$DOWNLOAD_URL"

echo "==> Verifying package integrity & staging files ..."
python3 - "$ZIP_PATH" "$TMP_DIR/extracted" <<'PYEOF'
import json
import os
import sys
import zipfile

zip_path, extract_dir = sys.argv[1], sys.argv[2]
if not zipfile.is_zipfile(zip_path):
    sys.exit("ERROR: Downloaded file is not a valid ZIP archive.")

with zipfile.ZipFile(zip_path, "r") as zf:
    names = set(zf.namelist())
    required = {
        "next-unlock/plugin.json",
        "next-unlock/main.py",
        "next-unlock/dist/index.js",
    }
    missing = required - names
    if missing:
        sys.exit(f"ERROR: Release archive is missing required files: {sorted(missing)}")
    meta = json.loads(zf.read("next-unlock/plugin.json").decode("utf-8"))
    os.makedirs(extract_dir, exist_ok=True)
    zf.extractall(extract_dir)
    print(f"    Verified {meta.get('name', 'Next Unlock')} (main: {meta.get('main')})")
PYEOF

STAGED_DIR="${TMP_DIR}/extracted/${PLUGIN_NAME}"

# Determine whether elevated privileges are needed to write to ~/homebrew/plugins
USE_SUDO=""
if [ ! -d "$PLUGINS_DIR" ] || [ ! -w "$PLUGINS_DIR" ] || { [ -d "$TARGET_DIR" ] && [ ! -w "$TARGET_DIR" ]; }; then
  if command -v sudo >/dev/null 2>&1; then
    USE_SUDO="sudo"
  fi
fi

echo "==> Installing to ${TARGET_DIR} ..."
$USE_SUDO mkdir -p "$PLUGINS_DIR"
if [ -d "$TARGET_DIR" ]; then
  echo "    Removing previous installation at ${TARGET_DIR} (user settings in ~/.config/next-unlock are preserved) ..."
  $USE_SUDO rm -rf "$TARGET_DIR"
fi

$USE_SUDO cp -R "$STAGED_DIR" "$TARGET_DIR"
$USE_SUDO chmod -R 755 "$TARGET_DIR"

if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files plugin_loader.service >/dev/null 2>&1; then
  echo "==> Restarting Decky Loader (plugin_loader.service) ..."
  if [ -n "$USE_SUDO" ]; then
    sudo systemctl restart plugin_loader
  elif command -v sudo >/dev/null 2>&1; then
    sudo systemctl restart plugin_loader
  else
    systemctl restart plugin_loader
  fi
fi

echo "✅ Next Unlock installed and updated! Open the Quick Access Menu (...) on your Steam Deck."
