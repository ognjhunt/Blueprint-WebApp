#!/usr/bin/env bash
set -euo pipefail

SWAPFILE_PATH="${SWAPFILE_PATH:-/swapfile}"
SWAPFILE_SIZE_GB="${SWAPFILE_SIZE_GB:-4}"
SYSCTL_PATH="/etc/sysctl.d/99-blueprint-paperclip.conf"
SYSTEMD_DROPIN_DIR="/etc/systemd/system/paperclip.service.d"
SYSTEMD_DROPIN_PATH="${SYSTEMD_DROPIN_DIR}/override.conf"
PRUNE_SERVICE_PATH="/etc/systemd/system/blueprint-paperclip-prune.service"
PRUNE_TIMER_PATH="/etc/systemd/system/blueprint-paperclip-prune.timer"
WEBAPP_REPO="/Users/nijelhunt_1/workspace/Blueprint-WebApp"
PAPERCLIP_ENV_FILE="/Users/nijelhunt_1/workspace/.paperclip-blueprint.env"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root." >&2
  exit 1
fi

if ! swapon --show | grep -q "^${SWAPFILE_PATH}"; then
  if [ ! -f "$SWAPFILE_PATH" ]; then
    fallocate -l "${SWAPFILE_SIZE_GB}G" "$SWAPFILE_PATH"
    chmod 600 "$SWAPFILE_PATH"
    mkswap "$SWAPFILE_PATH"
  fi
  swapon "$SWAPFILE_PATH"
fi

if ! grep -q "^${SWAPFILE_PATH} " /etc/fstab; then
  echo "${SWAPFILE_PATH} none swap sw 0 0" >> /etc/fstab
fi

cat > "$SYSCTL_PATH" <<'EOF'
vm.swappiness=10
vm.vfs_cache_pressure=50
EOF
sysctl --system >/dev/null

mkdir -p "$SYSTEMD_DROPIN_DIR"
cat > "$SYSTEMD_DROPIN_PATH" <<'EOF'
[Service]
Environment=BLUEPRINT_PAPERCLIP_NODE_OPTIONS=--max-old-space-size=2560
Environment=MALLOC_ARENA_MAX=2
EOF

cat > "$PRUNE_SERVICE_PATH" <<EOF
[Unit]
Description=Prune Blueprint Paperclip runtime data
Wants=paperclip.service
After=paperclip.service

[Service]
Type=oneshot
Environment=PAPERCLIP_ENV_FILE=${PAPERCLIP_ENV_FILE}
Environment=BLUEPRINT_PAPERCLIP_RESTART_MODE=none
Environment=BLUEPRINT_PAPERCLIP_SYSTEMD_SERVICE=paperclip.service
Environment=KEEP_LATEST_BACKUPS=3
Environment=BACKUP_TMP_RETENTION_MINUTES=180
Environment=RUN_LOG_RETENTION_DAYS=7
Environment=SESSION_RETENTION_DAYS=7
ExecStart=/usr/bin/env bash ${WEBAPP_REPO}/scripts/paperclip/prune-paperclip-runtime.sh
EOF

cat > "$PRUNE_TIMER_PATH" <<'EOF'
[Unit]
Description=Run Blueprint Paperclip runtime pruning hourly

[Timer]
OnCalendar=hourly
RandomizedDelaySec=15m
Persistent=true

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now blueprint-paperclip-prune.timer >/dev/null

echo "Swap, Paperclip host guardrails, and runtime prune timer configured."
swapon --show
systemctl --no-pager --full status blueprint-paperclip-prune.timer | sed -n '1,12p'
