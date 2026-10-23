#!/usr/bin/env bash
# Install Chromium and its system packages for the CI browser checks.
#
# The system packages come from the runner's Ubuntu mirror, which can crawl
# for minutes (2026-10-23: one 7 MB font package took over two minutes and the
# step hit its 10-minute limit before any test ran). Per-connection timeouts
# and retries let apt move on to the next mirror in the runner's mirror list,
# and a stalled install is retried a bounded number of times.
set -uo pipefail

echo 'Acquire::Retries "3"; Acquire::http::Timeout "30"; Acquire::https::Timeout "30";' \
  | sudo tee /etc/apt/apt.conf.d/80-blueprint-ci-retries >/dev/null

for attempt in 1 2 3; do
  if timeout 6m npx playwright install --with-deps chromium; then
    exit 0
  fi
  echo "::warning::Playwright install attempt ${attempt} failed or stalled; retrying"
  # A stalled attempt can stop apt mid-install; finish any half-configured package.
  sudo dpkg --configure -a || true
done
exit 1
