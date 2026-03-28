#!/usr/bin/env bash
set -euo pipefail

LABEL="com.blueprint.paperclip"
PLIST_PATH="${HOME}/Library/LaunchAgents/${LABEL}.plist"
BOOTSTRAP_SCRIPT="/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/bootstrap-blueprint-paperclip.sh"
PAPERCLIP_HOME="${PAPERCLIP_HOME:-/Users/nijelhunt_1/workspace/.paperclip-blueprint}"
PAPERCLIP_ENV_FILE="${PAPERCLIP_ENV_FILE:-/Users/nijelhunt_1/workspace/.paperclip-blueprint.env}"
LOG_DIR="$PAPERCLIP_HOME/launchd"
STDOUT_LOG="$LOG_DIR/stdout.log"
STDERR_LOG="$LOG_DIR/stderr.log"
INTERVAL_SECONDS="${INTERVAL_SECONDS:-300}"
NODE_BIN_DIR="$(dirname "$(command -v node)")"
BASE_PATH="${PATH:-/usr/bin:/bin:/usr/sbin:/sbin}"
LAUNCH_PATH="${NODE_BIN_DIR}:${BASE_PATH}"

mkdir -p "$LOG_DIR"

cat >"$PLIST_PATH" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${BOOTSTRAP_SCRIPT}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>StartInterval</key>
  <integer>${INTERVAL_SECONDS}</integer>
  <key>StandardOutPath</key>
  <string>${STDOUT_LOG}</string>
  <key>StandardErrorPath</key>
  <string>${STDERR_LOG}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>HOME</key>
    <string>${HOME}</string>
    <key>PATH</key>
    <string>${LAUNCH_PATH}</string>
    <key>PAPERCLIP_HOME</key>
    <string>${PAPERCLIP_HOME}</string>
    <key>PAPERCLIP_ENV_FILE</key>
    <string>${PAPERCLIP_ENV_FILE}</string>
  </dict>
</dict>
</plist>
PLIST

launchctl bootout "gui/$(id -u)" "$PLIST_PATH" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "$PLIST_PATH"
launchctl kickstart -k "gui/$(id -u)/${LABEL}"

echo "Installed LaunchAgent ${LABEL}"
echo "plist: ${PLIST_PATH}"
