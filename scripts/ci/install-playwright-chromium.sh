#!/usr/bin/env bash
# Install Chromium and its system packages for the CI browser checks.
#
# The system packages come from the runner's Ubuntu mirror, which can crawl
# for minutes (2026-10-23: one 7 MB font package took over two minutes and the
# step hit its 10-minute limit before any test ran). Per-connection timeouts
# and retries let apt move on to the next mirror in the runner's mirror list,
# and a stalled install is retried a bounded number of times.
#
# A retry must also get the package lock. `timeout` stops npx, not the apt-get
# it started under sudo, and that apt-get keeps /var/lib/dpkg/lock-frontend: on
# 2026-10-26 (main CI for #1107) attempt 1 stalled on the mirror, and attempts 2
# and 3 failed in two seconds on that lock, so the deploy was skipped. apt now
# waits for a held lock, and a retry first stops what the last attempt left.
set -uo pipefail

echo 'Acquire::Retries "3"; Acquire::http::Timeout "30"; Acquire::https::Timeout "30"; DPkg::Lock::Timeout "300";' \
  | sudo tee /etc/apt/apt.conf.d/80-blueprint-ci-retries >/dev/null

for attempt in 1 2 3; do
  if timeout 6m npx playwright install --with-deps chromium; then
    exit 0
  fi
  echo "::warning::Playwright install attempt ${attempt} failed or stalled; retrying"
  # Stop the apt-get the stalled attempt left holding the lock, then finish any
  # half-configured package.
  sudo pkill -x apt-get || true
  sudo dpkg --configure -a || true
done
exit 1
