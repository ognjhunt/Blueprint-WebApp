#!/usr/bin/env bash
set -euo pipefail

SWAPFILE_PATH="${SWAPFILE_PATH:-/swapfile}"
SWAPFILE_SIZE_GB="${SWAPFILE_SIZE_GB:-4}"
SYSCTL_PATH="/etc/sysctl.d/99-blueprint-paperclip.conf"
SYSTEMD_DROPIN_DIR="/etc/systemd/system/paperclip.service.d"
SYSTEMD_DROPIN_PATH="${SYSTEMD_DROPIN_DIR}/override.conf"

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

systemctl daemon-reload

echo "Swap and Paperclip host guardrails configured."
swapon --show
