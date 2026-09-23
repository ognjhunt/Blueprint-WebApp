# shellcheck shell=bash
# shellcheck disable=SC2034 # constants here are read by the scripts that source this file
#
# Shared helpers for the Blueprint cloud-session scripts in scripts/cloud/.
#
# setup-environment.sh (root, before Claude starts) and bootstrap.sh (inside
# the session) run the same idempotent install steps defined here; doctor.sh
# reuses the path and version helpers. Every location is derived at runtime
# from this checkout, so nothing here names a particular user's home.
#
# Sourced, never executed. Kept bash 3.2 compatible so doctor.sh also runs on
# a stock macOS shell.

CLOUD_LIB_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)

CLOUD_UV_VERSION=0.10.7
CLOUD_TORCH_VERSION=2.10.0
CLOUD_TORCH_INDEX_URL=https://download.pytorch.org/whl/cpu
CLOUD_PIPELINE_REPO_NAME=BlueprintCapturePipeline
CLOUD_FIREBASE_PROJECT_ID=blueprint-8c1ca
CLOUD_DOOR_DEFAULT_URL=https://paperclip.tryblueprint.io/api/live-pipeline/operator/v1
CLOUD_APT_PACKAGES="ffmpeg libgl1 libegl1 libosmesa6 libglfw3 jq gh libnss3-tools"
CLOUD_STATE_DIR=${BLUEPRINT_CLOUD_STATE_DIR:-/opt/blueprint-cloud}
CLOUD_USER_DIR=${HOME:-/root}/.blueprint-cloud
CLOUD_SKIP=100         # a step returns this when it does not apply here (recorded as n/a)
CLOUD_GRACE_SECONDS=15 # how far a step started before the setup deadline may run past it

# The WebApp checkout is the git toplevel of this file. Root in a clone owned
# by another user makes git refuse ("dubious ownership"), so fall back to the
# directory layout.
CLOUD_REPO_ROOT=$(git -C "$CLOUD_LIB_DIR" rev-parse --show-toplevel 2>/dev/null) || CLOUD_REPO_ROOT=""
[ -n "$CLOUD_REPO_ROOT" ] || CLOUD_REPO_ROOT=$(cd "$CLOUD_LIB_DIR/../.." && pwd -P)

log() {
  [ "${CLOUD_QUIET:-0}" = 1 ] || printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*"
}
warn() { printf '[%s] WARN %s\n' "$(date -u +%H:%M:%S)" "$*" >&2; }
have() { command -v "$1" >/dev/null 2>&1; }

cloud_repo_root() { printf '%s\n' "$CLOUD_REPO_ROOT"; }
# Cloud sessions clone every selected repository side by side.
cloud_workspace() { dirname "$CLOUD_REPO_ROOT"; }
cloud_pipeline_root() {
  if [ -n "${BLUEPRINT_PIPELINE_ROOT:-}" ]; then
    printf '%s\n' "$BLUEPRINT_PIPELINE_ROOT"
  else
    printf '%s/%s\n' "$(cloud_workspace)" "$CLOUD_PIPELINE_REPO_NAME"
  fi
}
cloud_pipeline_present() { [ -f "$(cloud_pipeline_root)/pyproject.toml" ]; }
cloud_venv_dir() { printf '%s/pipeline-venv\n' "$CLOUD_STATE_DIR"; }
cloud_venv_python() { printf '%s/pipeline-venv/bin/python\n' "$CLOUD_STATE_DIR"; }
cloud_uv_path() { printf '%s/bin/uv\n' "$CLOUD_STATE_DIR"; }
cloud_env_file() { printf '%s/env.sh\n' "$CLOUD_USER_DIR"; }

# Pick up what bootstrap recorded (venv, uv on PATH, door URL, state dir).
cloud_load_env_file() {
  local file
  file=$(cloud_env_file)
  if [ -f "$file" ]; then
    # shellcheck source=/dev/null
    . "$file"
  fi
  CLOUD_STATE_DIR=${BLUEPRINT_CLOUD_STATE_DIR:-$CLOUD_STATE_DIR}
  return 0
}

cloud_is_root() { [ "$(id -u)" = 0 ]; }
cloud_has_apt() { [ "$(uname -s)" = Linux ] && have apt-get && have dpkg-query; }

cloud_sha256() {
  if have sha256sum; then
    sha256sum "$1" | awk '{print $1}'
  elif have shasum; then
    shasum -a 256 "$1" | awk '{print $1}'
  else
    python3 -c 'import hashlib, sys; print(hashlib.sha256(open(sys.argv[1], "rb").read()).hexdigest())' "$1"
  fi
}

# cloud_timeout SECONDS CMD... - GNU timeout where present (it kills the whole
# process group), otherwise a perl alarm so doctor.sh still works on macOS.
cloud_timeout() {
  local secs=$1
  shift
  if have timeout; then
    timeout -k 5 "$secs" "$@"
  elif have gtimeout; then
    gtimeout -k 5 "$secs" "$@"
  else
    perl -e 'alarm shift @ARGV; exec @ARGV or exit 127' "$secs" "$@"
  fi
}

# setup-environment.sh sets CLOUD_DEADLINE (a $SECONDS value). Steps do not
# start after it, and a running command is cut off CLOUD_GRACE_SECONDS later.
# Without a deadline (bootstrap.sh) commands run unbounded.
cloud_deadline_passed() { [ -n "${CLOUD_DEADLINE:-}" ] && [ "$SECONDS" -ge "$CLOUD_DEADLINE" ]; }
cloud_bounded() {
  local left
  if [ -z "${CLOUD_DEADLINE:-}" ]; then
    "$@"
    return
  fi
  left=$((CLOUD_DEADLINE + CLOUD_GRACE_SECONDS - SECONDS))
  if [ "$left" -le 0 ]; then
    echo "setup time budget used up before: $1" >&2
    return 124
  fi
  cloud_timeout "$left" "$@"
}

cloud_prepare_state_dir() {
  mkdir -p "$CLOUD_STATE_DIR/steps" "$CLOUD_STATE_DIR/logs" "$CLOUD_STATE_DIR/locks" \
    "$CLOUD_STATE_DIR/markers" "$CLOUD_STATE_DIR/bin" 2>/dev/null && [ -w "$CLOUD_STATE_DIR" ]
}

# --- step bookkeeping ------------------------------------------------------
# Each step leaves $CLOUD_STATE_DIR/steps/<name>.status (read by doctor.sh)
# and its full output in $CLOUD_STATE_DIR/logs/<name>.log. When
# CLOUD_RUN_RESULTS names a file, the step also appends "<name> <status> <rc>"
# there so the caller can summarize the run.

cloud_record_step() { # name status rc seconds
  {
    printf 'status=%s\nrc=%s\nseconds=%s\n' "$2" "$3" "$4"
    printf 'at=%s\nby=%s\nlog=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${CLOUD_RUNNER:-manual}" \
      "$CLOUD_STATE_DIR/logs/$1.log"
  } >"$CLOUD_STATE_DIR/steps/$1.status" 2>/dev/null
  if [ -n "${CLOUD_RUN_RESULTS:-}" ]; then
    printf '%s %s %s\n' "$1" "$2" "$3" >>"$CLOUD_RUN_RESULTS"
  fi
  return 0
}

cloud_run_step() { # name function [args...]
  local name=$1 steplog start rc=0 status
  shift
  steplog="$CLOUD_STATE_DIR/logs/$name.log"
  if cloud_deadline_passed; then
    log "$name: deferred (setup time budget used up; bootstrap.sh finishes it)"
    echo "deferred: setup time budget used up before this step started" >"$steplog"
    cloud_record_step "$name" deferred - 0
    return 0
  fi
  start=$SECONDS
  log "$name: start"
  "$@" >"$steplog" 2>&1 || rc=$?
  case $rc in
    0) status=ok ;;
    "$CLOUD_SKIP") status=n/a ;;
    124 | 137 | 142) status=timeout ;;
    *) status=failed ;;
  esac
  if [ "$status" = n/a ]; then
    log "$name: n/a ($(head -n 1 "$steplog"))"
  else
    log "$name: $status ($((SECONDS - start))s, log $steplog)"
  fi
  if [ "$status" = failed ] || [ "$status" = timeout ]; then
    [ "${CLOUD_QUIET:-0}" = 1 ] || tail -n 12 "$steplog" | sed 's/^/    | /'
  fi
  cloud_record_step "$name" "$status" "$rc" "$((SECONDS - start))"
  return 0
}

# Prints a one-line summary of CLOUD_RUN_RESULTS; returns 1 when any step did
# not finish (failed, timed out or deferred).
cloud_summarize_run() { # label
  local name status _rc ok=0 unfinished=""
  while read -r name status _rc; do
    [ -n "$name" ] || continue
    case $status in
      ok | n/a) ok=$((ok + 1)) ;;
      *) unfinished="$unfinished $name=$status" ;;
    esac
  done <"$CLOUD_RUN_RESULTS"
  if [ -z "$unfinished" ]; then
    printf '%s: %s steps ok\n' "$1" "$ok"
    return 0
  fi
  printf '%s: %s steps ok; unfinished:%s (logs in %s/logs)\n' "$1" "$ok" "$unfinished" "$CLOUD_STATE_DIR"
  return 1
}

# --- install steps ---------------------------------------------------------
# Every step is idempotent and detects "already done" cheaply, so bootstrap.sh
# can rerun all of them at every session start.

# apt-get is not safe to run twice at once; Playwright's install-deps calls it
# too, so both go through this lock.
cloud_with_apt_lock() {
  local wait=1200
  [ -z "${CLOUD_DEADLINE:-}" ] || wait=$((CLOUD_DEADLINE + CLOUD_GRACE_SECONDS - SECONDS))
  [ "$wait" -ge 1 ] || wait=1
  if ! have flock; then
    "$@"
    return
  fi
  (
    flock -w "$wait" 9 || {
      echo "gave up waiting for the apt lock"
      exit 1
    }
    "$@"
  ) 9>"$CLOUD_STATE_DIR/locks/apt.lock"
}

cloud_apt_install() { # packages...
  local opts="-o Acquire::Retries=3 -o Acquire::http::Timeout=30 -o Acquire::https::Timeout=30 -o DPkg::Lock::Timeout=120"
  export DEBIAN_FRONTEND=noninteractive
  # A setup run cut off mid-install leaves dpkg half-configured.
  dpkg --configure -a || true
  # shellcheck disable=SC2086 # $opts is a list of apt options
  cloud_bounded apt-get $opts update || return
  # shellcheck disable=SC2086
  cloud_bounded apt-get $opts install -y --no-install-recommends "$@"
}

cloud_missing_apt_packages() {
  local pkg missing=""
  for pkg in $CLOUD_APT_PACKAGES; do
    # shellcheck disable=SC2016 # ${Status} is a dpkg-query field, not a shell expansion
    dpkg-query -W -f='${Status}' "$pkg" 2>/dev/null | grep -q 'install ok installed' || missing="$missing $pkg"
  done
  printf '%s\n' "${missing# }"
}

# ffmpeg/ffprobe for the review-video tests and media checks, the GL
# libraries MuJoCo needs for MUJOCO_GL=osmesa, jq, the GitHub CLI (not in the
# cloud image), and certutil for the browser-trust step.
cloud_step_system_packages() {
  local missing
  if ! cloud_has_apt; then
    echo "no apt-get here; install these yourself: $CLOUD_APT_PACKAGES"
    return "$CLOUD_SKIP"
  fi
  missing=$(cloud_missing_apt_packages)
  if [ -z "$missing" ]; then
    echo "already installed: $CLOUD_APT_PACKAGES"
    return 0
  fi
  if ! cloud_is_root; then
    echo "needs root to install: $missing"
    return "$CLOUD_SKIP"
  fi
  echo "installing: $missing"
  # shellcheck disable=SC2086 # one word per package
  cloud_with_apt_lock cloud_apt_install $missing
}

cloud_uv_version_ok() { # path-to-uv
  local out
  out=$("$1" --version 2>/dev/null) || return 1
  case $out in
    "uv $CLOUD_UV_VERSION" | "uv $CLOUD_UV_VERSION "*) return 0 ;;
  esac
  return 1
}

# The Pipeline pins uv exactly (required-version ==0.10.7). The pinned binary
# goes into $CLOUD_STATE_DIR/bin, which env.sh puts first on PATH, so a
# different preinstalled uv cannot shadow it. It is taken straight from the
# PyPI wheel (sha256-checked against PyPI's metadata), which needs neither pip
# nor GitHub release downloads.
cloud_step_uv() {
  local uv
  uv=$(cloud_uv_path)
  if cloud_uv_version_ok "$uv"; then
    echo "uv $CLOUD_UV_VERSION already at $uv"
    return 0
  fi
  have python3 || {
    echo "python3 is required to install uv"
    return 1
  }
  mkdir -p "$CLOUD_STATE_DIR/bin" || return
  cloud_bounded python3 - "$CLOUD_UV_VERSION" "$CLOUD_STATE_DIR/bin" <<'PY' || return
import hashlib
import json
import os
import platform
import sys
import tempfile
import urllib.request
import zipfile

version, dest = sys.argv[1], sys.argv[2]
arch = {"x86_64": "x86_64", "amd64": "x86_64", "aarch64": "aarch64", "arm64": "aarch64"}.get(
    platform.machine().lower()
)
system = platform.system()
if system == "Linux" and arch:
    wanted = lambda name: "manylinux" in name and name.endswith("_%s.whl" % arch)
elif system == "Darwin" and arch:
    suffix = "_arm64.whl" if arch == "aarch64" else "_x86_64.whl"
    wanted = lambda name: "macosx" in name and name.endswith(suffix)
else:
    sys.exit("no uv wheel for %s/%s" % (system, platform.machine()))

with urllib.request.urlopen("https://pypi.org/pypi/uv/%s/json" % version, timeout=60) as response:
    files = json.load(response)["urls"]
wheels = [f for f in files if f["filename"].endswith(".whl") and wanted(f["filename"])]
if not wheels:
    sys.exit("PyPI lists no uv %s wheel for %s/%s" % (version, system, arch))
wheel = wheels[0]

digest = hashlib.sha256()
with tempfile.TemporaryFile() as tmp:
    with urllib.request.urlopen(wheel["url"], timeout=300) as response:
        for chunk in iter(lambda: response.read(1 << 20), b""):
            digest.update(chunk)
            tmp.write(chunk)
    if digest.hexdigest() != wheel["digests"]["sha256"]:
        sys.exit("sha256 mismatch for %s" % wheel["filename"])
    tmp.seek(0)
    with zipfile.ZipFile(tmp) as archive:
        members = archive.namelist()
        for tool in ("uv", "uvx"):
            member = next((m for m in members if m.endswith(".data/scripts/" + tool)), None)
            if member is None:
                sys.exit("%s not found in %s" % (tool, wheel["filename"]))
            target = os.path.join(dest, tool)
            with archive.open(member) as src, open(target + ".tmp", "wb") as out:
                out.write(src.read())
            os.chmod(target + ".tmp", 0o755)
            os.replace(target + ".tmp", target)
print("installed uv %s from %s" % (version, wheel["filename"]))
PY
  if ! cloud_uv_version_ok "$uv"; then
    echo "the installed $uv does not report $CLOUD_UV_VERSION"
    return 1
  fi
}

# Pipeline virtualenv outside the clone ($CLOUD_STATE_DIR/pipeline-venv via
# UV_PROJECT_ENVIRONMENT), the canonical `uv sync --frozen --extra dev`.
cloud_step_pipeline_venv() {
  local pipeline venv uv marker key
  pipeline=$(cloud_pipeline_root)
  venv=$(cloud_venv_dir)
  uv=$(cloud_uv_path)
  if ! cloud_pipeline_present; then
    echo "no Pipeline checkout at $pipeline"
    return "$CLOUD_SKIP"
  fi
  if ! cloud_uv_version_ok "$uv"; then
    echo "uv $CLOUD_UV_VERSION is missing (see the uv step)"
    return 1
  fi
  marker="$venv/.blueprint-cloud-uv-sync"
  key="lock=$(cloud_sha256 "$pipeline/uv.lock") extras=dev uv=$CLOUD_UV_VERSION"
  if [ -x "$venv/bin/python" ] && [ -f "$marker" ] && [ "$(cat "$marker")" = "$key" ]; then
    echo "virtualenv already matches uv.lock"
    return 0
  fi
  (cd "$pipeline" && cloud_bounded env UV_PROJECT_ENVIRONMENT="$venv" "$uv" sync --frozen --extra dev) || return
  printf '%s\n' "$key" >"$marker"
}

# CPU torch is installed on top of the lock, as the Pipeline's CI does. An
# exact `uv sync` removes it again, so presence is checked every time.
cloud_step_torch() {
  local py
  py=$(cloud_venv_python)
  if ! cloud_pipeline_present; then
    echo "no Pipeline checkout at $(cloud_pipeline_root)"
    return "$CLOUD_SKIP"
  fi
  if [ ! -x "$py" ]; then
    echo "no Pipeline virtualenv at $(cloud_venv_dir) (see the pipeline-venv step)"
    return 1
  fi
  if "$py" -c 'import importlib.metadata as m, sys; sys.exit(m.version("torch").split("+")[0] != sys.argv[1])' \
    "$CLOUD_TORCH_VERSION" 2>/dev/null; then
    echo "torch $CLOUD_TORCH_VERSION already installed"
    return 0
  fi
  cloud_bounded "$(cloud_uv_path)" pip install --python "$py" --index-url "$CLOUD_TORCH_INDEX_URL" \
    "torch==$CLOUD_TORCH_VERSION"
}

cloud_step_webapp_npm() {
  local root=$CLOUD_REPO_ROOT marker key
  have npm || {
    echo "npm is not on PATH"
    return 1
  }
  marker="$root/node_modules/.blueprint-cloud-npm-ci"
  key="lock=$(cloud_sha256 "$root/package-lock.json") node=$(node --version 2>/dev/null)"
  if [ -f "$marker" ] && [ "$(cat "$marker")" = "$key" ]; then
    echo "node_modules already match package-lock.json"
    return 0
  fi
  (cd "$root" && cloud_bounded npm ci --no-audit --no-fund --prefer-offline) || return
  mkdir -p "$root/node_modules" && printf '%s\n' "$key" >"$marker"
}

# `playwright install chromium` is itself a fast no-op once the browser is
# present, so it runs every time; its system libraries are a separate step
# because they need root and the apt lock.
cloud_step_playwright_chromium() {
  local root=$CLOUD_REPO_ROOT
  if [ -n "${PLAYWRIGHT_CHROMIUM_EXECUTABLE:-}" ]; then
    if [ -x "$PLAYWRIGHT_CHROMIUM_EXECUTABLE" ]; then
      echo "using PLAYWRIGHT_CHROMIUM_EXECUTABLE"
      return 0
    fi
    echo "PLAYWRIGHT_CHROMIUM_EXECUTABLE is set but not executable"
    return 1
  fi
  if [ ! -x "$root/node_modules/.bin/playwright" ]; then
    echo "Playwright is not installed (see the webapp-npm step)"
    return 1
  fi
  (cd "$root" && cloud_bounded ./node_modules/.bin/playwright install chromium)
}

cloud_step_playwright_deps() {
  local root=$CLOUD_REPO_ROOT version marker
  if [ -n "${PLAYWRIGHT_CHROMIUM_EXECUTABLE:-}" ]; then
    echo "PLAYWRIGHT_CHROMIUM_EXECUTABLE is set; that browser brings its own libraries"
    return "$CLOUD_SKIP"
  fi
  if ! cloud_has_apt; then
    echo "no apt-get here; Chromium's system libraries come from the host"
    return "$CLOUD_SKIP"
  fi
  if ! cloud_is_root; then
    echo "needs root to install Chromium's system libraries"
    return "$CLOUD_SKIP"
  fi
  if [ ! -x "$root/node_modules/.bin/playwright" ]; then
    echo "Playwright is not installed (see the webapp-npm step)"
    return 1
  fi
  version=$(node -p 'require(process.argv[1]).version' "$root/node_modules/@playwright/test/package.json") || return
  marker="$CLOUD_STATE_DIR/markers/playwright-deps-$version"
  if [ -f "$marker" ]; then
    echo "Chromium system libraries already installed for Playwright $version"
    return 0
  fi
  (cd "$root" && cloud_with_apt_lock cloud_bounded ./node_modules/.bin/playwright install-deps chromium) || return
  touch "$marker"
}

# Cloud egress goes through a TLS-terminating proxy. curl, Python, Node and
# gRPC trust it through SSL_CERT_FILE and friends, but Chromium keeps its own
# NSS store, so without this step every https page fails with
# ERR_CERT_AUTHORITY_INVALID. Imports only the certificates in SSL_CERT_FILE
# that the system bundle lacks (the proxy's CA), idempotently.
cloud_step_browser_trust() {
  local bundle=${SSL_CERT_FILE:-} nssdb="${HOME:-/root}/.pki/nssdb"
  if [ -z "$bundle" ] || [ ! -f "$bundle" ]; then
    echo "SSL_CERT_FILE is not set; no proxy certificate to trust"
    return "$CLOUD_SKIP"
  fi
  have certutil || {
    echo "certutil is missing (libnss3-tools; see the system-packages step)"
    return 1
  }
  python3 - "$bundle" /etc/ssl/certs/ca-certificates.crt "$nssdb" <<'PY'
import base64, hashlib, os, re, subprocess, sys, tempfile
bundle, system, nssdb = sys.argv[1:]
block = re.compile(rb"-----BEGIN CERTIFICATE-----(.+?)-----END CERTIFICATE-----", re.S)
def ders(path):
    try:
        data = open(path, "rb").read()
    except OSError:
        return []
    return [base64.b64decode(b"".join(body.split())) for body in block.findall(data)]
known = {hashlib.sha256(der).hexdigest() for der in ders(system)}
extra = [der for der in ders(bundle) if hashlib.sha256(der).hexdigest() not in known]
if not extra:
    print("SSL_CERT_FILE adds nothing beyond the system bundle")
    sys.exit(0)
os.makedirs(nssdb, mode=0o700, exist_ok=True)
db = "sql:" + nssdb
if not os.path.exists(os.path.join(nssdb, "cert9.db")):
    subprocess.run(["certutil", "-d", db, "-N", "--empty-password"], check=True)
added = 0
for der in extra:
    name = "blueprint-cloud-proxy-" + hashlib.sha256(der).hexdigest()[:12]
    if subprocess.run(["certutil", "-d", db, "-L", "-n", name], capture_output=True).returncode == 0:
        continue
    with tempfile.NamedTemporaryFile(suffix=".der") as tmp:
        tmp.write(der)
        tmp.flush()
        subprocess.run(["certutil", "-d", db, "-A", "-t", "C,,", "-n", name, "-i", tmp.name], check=True)
    added += 1
print("Chromium trusts %d proxy certificate(s) in %s (%d newly added)" % (len(extra), nssdb, added))
PY
}

# --full-history: blob-less unshallow of the Pipeline clone, and origin/main in
# both repos (cloud clones are shallow at a detached HEAD).
cloud_step_git_history() {
  local pipeline rc=0
  pipeline=$(cloud_pipeline_root)
  if cloud_pipeline_present; then
    if [ "$(git -C "$pipeline" rev-parse --is-shallow-repository 2>/dev/null)" = true ]; then
      echo "unshallowing $pipeline (blob-less)"
      git -C "$pipeline" fetch --filter=blob:none --unshallow origin || rc=1
    fi
    git -C "$pipeline" fetch origin '+refs/heads/main:refs/remotes/origin/main' || rc=1
  else
    echo "no Pipeline checkout at $pipeline"
  fi
  git -C "$CLOUD_REPO_ROOT" fetch origin '+refs/heads/main:refs/remotes/origin/main' || rc=1
  return "$rc"
}

# --- lanes -----------------------------------------------------------------
# Three independent lanes run in parallel; apt users serialize on the lock.

cloud_lane_system() {
  cloud_run_step system-packages cloud_step_system_packages
}

cloud_lane_pipeline() {
  cloud_run_step uv cloud_step_uv
  cloud_run_step pipeline-venv cloud_step_pipeline_venv
  cloud_run_step torch cloud_step_torch
}

cloud_lane_webapp() {
  cloud_run_step webapp-npm cloud_step_webapp_npm
  cloud_run_step playwright-chromium cloud_step_playwright_chromium
  cloud_run_step playwright-deps cloud_step_playwright_deps
}

cloud_install_all() {
  local system_pid pipeline_pid webapp_pid
  cloud_lane_system &
  system_pid=$!
  cloud_lane_pipeline &
  pipeline_pid=$!
  cloud_lane_webapp &
  webapp_pid=$!
  wait "$system_pid" "$pipeline_pid" "$webapp_pid"
  # Needs certutil from the system lane, so it runs after the lanes join.
  cloud_run_step browser-trust cloud_step_browser_trust
}

# --- session environment ---------------------------------------------------

# ~/.blueprint-cloud/env.sh: what later shells need to find the toolchain.
cloud_write_env_file() {
  local file tmp
  file=$(cloud_env_file)
  (umask 077 && mkdir -p "$CLOUD_USER_DIR") && chmod 700 "$CLOUD_USER_DIR" || return 1
  tmp="$file.tmp.$$"
  {
    echo "# Written by scripts/cloud/bootstrap.sh and setup-environment.sh; safe to source repeatedly."
    printf 'export BLUEPRINT_CLOUD_STATE_DIR=%q\n' "$CLOUD_STATE_DIR"
    printf 'export BLUEPRINT_PIPELINE_ROOT=%q\n' "$(cloud_pipeline_root)"
    printf 'export BLUEPRINT_PIPELINE_PYTHON=%q\n' "$(cloud_venv_python)"
    printf 'export UV_PROJECT_ENVIRONMENT=%q\n' "$(cloud_venv_dir)"
    echo "export MUJOCO_GL=osmesa"
    if [ "${CLAUDE_CODE_REMOTE:-}" = true ]; then
      # Firestore over REST works through the cloud's TLS-terminating proxy
      # where gRPC may not; read by client/src/lib/firebaseAdmin.ts.
      echo "export BLUEPRINT_FIRESTORE_PREFER_REST=1"
    fi
    # shellcheck disable=SC2016 # expanded when env.sh is sourced, keeping an explicit override
    printf 'export BLUEPRINT_OPERATOR_DOOR_URL="${BLUEPRINT_OPERATOR_DOOR_URL:-%s}"\n' "$CLOUD_DOOR_DEFAULT_URL"
    if [ -n "${PLAYWRIGHT_BROWSERS_PATH:-}" ]; then
      printf 'export PLAYWRIGHT_BROWSERS_PATH=%q\n' "$PLAYWRIGHT_BROWSERS_PATH"
    fi
    # shellcheck disable=SC2016 # $PATH is expanded when env.sh is sourced
    printf 'case ":$PATH:" in *:%q:*) ;; *) export PATH=%q:"$PATH" ;; esac\n' \
      "$CLOUD_STATE_DIR/bin" "$CLOUD_STATE_DIR/bin"
  } >"$tmp" && mv -f "$tmp" "$file"
}
