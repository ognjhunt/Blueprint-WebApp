#!/usr/bin/env bash
# WebApp-only installation for Codex or Claude cloud clones. No live services.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

node -e 'if (Number(process.versions.node.split(".")[0]) < 20) process.exit(1)' || {
  echo 'setup-webapp: install Node 20 or newer in the environment image' >&2
  exit 1
}
command -v npm >/dev/null
command -v git >/dev/null
if ! command -v gh >/dev/null; then
  if [ "$(uname -s)" = Linux ] && [ "$(id -u)" = 0 ] && command -v apt-get >/dev/null; then
    apt-get update -qq
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq gh
  else
    echo 'setup-webapp: install GitHub CLI (gh), then rerun' >&2
    exit 1
  fi
fi

# Revalidate against the lockfile on every installation/maintenance run.
npm ci --no-audit --no-fund --prefer-offline
if [ "${BLUEPRINT_CLOUD_INSTALL_BROWSER:-1}" = 1 ]; then
  if [ "$(uname -s)" = Linux ] && [ "$(id -u)" = 0 ]; then
    ./node_modules/.bin/playwright install --with-deps chromium
  else
    ./node_modules/.bin/playwright install chromium
  fi
fi
node scripts/cloud/release-doctor.mjs --offline
echo 'setup-webapp: installed. Before release work run node scripts/cloud/release-doctor.mjs'
