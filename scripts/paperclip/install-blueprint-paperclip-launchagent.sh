#!/usr/bin/env bash
set -euo pipefail

SERVER_LABEL="com.blueprint.paperclip"
MAINT_LABEL="com.blueprint.paperclip.maintenance"
SERVER_PLIST_PATH="${HOME}/Library/LaunchAgents/${SERVER_LABEL}.plist"
MAINT_PLIST_PATH="${HOME}/Library/LaunchAgents/${MAINT_LABEL}.plist"
BOOTSTRAP_SCRIPT="/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/bootstrap-blueprint-paperclip.sh"
MAINTENANCE_SCRIPT="/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/maintenance-blueprint-paperclip.sh"
SERVICE_SCRIPT="/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/run-blueprint-paperclip-service.sh"
PAPERCLIP_HOME="${PAPERCLIP_HOME:-/Users/nijelhunt_1/workspace/.paperclip-blueprint}"
PAPERCLIP_ENV_FILE="${PAPERCLIP_ENV_FILE:-/Users/nijelhunt_1/workspace/.paperclip-blueprint.env}"
LOG_DIR="$PAPERCLIP_HOME/launchd"
SERVER_STDOUT_LOG="$LOG_DIR/server.stdout.log"
SERVER_STDERR_LOG="$LOG_DIR/server.stderr.log"
MAINT_STDOUT_LOG="$LOG_DIR/maintenance.stdout.log"
MAINT_STDERR_LOG="$LOG_DIR/maintenance.stderr.log"
INTERVAL_SECONDS="${INTERVAL_SECONDS:-300}"
NODE_BIN_DIR="$(dirname "$(command -v node)")"
BASE_PATH="${PATH:-/usr/bin:/bin:/usr/sbin:/sbin}"
LAUNCH_PATH="${HOME}/.bun/bin:${NODE_BIN_DIR}:${BASE_PATH}"

mkdir -p "$LOG_DIR"
chmod +x "$BOOTSTRAP_SCRIPT" "$MAINTENANCE_SCRIPT" "$SERVICE_SCRIPT"

cat >"$SERVER_PLIST_PATH" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${SERVER_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${SERVICE_SCRIPT}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${SERVER_STDOUT_LOG}</string>
  <key>StandardErrorPath</key>
  <string>${SERVER_STDERR_LOG}</string>
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

cat >"$MAINT_PLIST_PATH" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${MAINT_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${MAINTENANCE_SCRIPT}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>StartInterval</key>
  <integer>${INTERVAL_SECONDS}</integer>
  <key>StandardOutPath</key>
  <string>${MAINT_STDOUT_LOG}</string>
  <key>StandardErrorPath</key>
  <string>${MAINT_STDERR_LOG}</string>
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

launchctl bootout "gui/$(id -u)" "$SERVER_PLIST_PATH" >/dev/null 2>&1 || true
launchctl bootout "gui/$(id -u)" "$MAINT_PLIST_PATH" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "$SERVER_PLIST_PATH"
launchctl bootstrap "gui/$(id -u)" "$MAINT_PLIST_PATH"
launchctl kickstart -k "gui/$(id -u)/${SERVER_LABEL}"
launchctl kickstart -k "gui/$(id -u)/${MAINT_LABEL}"

echo "Installed LaunchAgents ${SERVER_LABEL} and ${MAINT_LABEL}"
echo "server plist: ${SERVER_PLIST_PATH}"
echo "maintenance plist: ${MAINT_PLIST_PATH}"
