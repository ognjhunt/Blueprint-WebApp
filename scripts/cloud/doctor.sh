#!/usr/bin/env bash
# Readiness report for a Blueprint cloud session (claude.ai/code).
#
#   bash scripts/cloud/doctor.sh [--offline]
#
# Prints one PASS/WARN/FAIL line per check, a fix under every line that is
# not PASS, then a summary; exits 1 when any check FAILs. Checks run in
# parallel with per-check timeouts, so the report takes well under a minute.
# --offline skips the checks that reach network services (site, host,
# operator door, Firestore, GitHub).
#
# Secret values are never printed: the service account is reduced to its
# project id and client_email domain, the ops allowlist to a count, and the
# operator door to the token name and scopes it reports.
set -uo pipefail

DOCTOR_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
# shellcheck source=scripts/cloud/lib.sh
. "$DOCTOR_DIR/lib.sh"

SITE_VERSION_URL=https://tryblueprint.io/version.json
HOST_VERSION_URL=https://paperclip.tryblueprint.io/api/live-pipeline/version
PIPELINE_IMPORTS="pxr mujoco trimesh PIL numpy cv2 blueprint_pipeline"
FIX_BOOTSTRAP="bash scripts/cloud/bootstrap.sh"

# One result line: STATUS, name, detail, fix, separated by the ASCII unit
# separator so any text is safe inside a field.
result() { printf '%s\037%s\037%s\037%s\n' "$1" "$2" "$3" "${4:-}"; }

check_bootstrap_running() {
  local pid
  [ -f "$CLOUD_USER_DIR/bootstrap.pid" ] || return 0
  pid=$(cat "$CLOUD_USER_DIR/bootstrap.pid" 2>/dev/null)
  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
    result WARN "bootstrap" "still running (pid $pid, log $CLOUD_USER_DIR/bootstrap.log)" \
      "wait for it to finish, then rerun doctor"
  fi
}

check_webapp_repo() {
  local sha
  if [ -f "$CLOUD_REPO_ROOT/package.json" ]; then
    sha=$(git -C "$CLOUD_REPO_ROOT" rev-parse --short HEAD 2>/dev/null) || sha="?"
    result PASS "webapp repo" "$CLOUD_REPO_ROOT @ $sha"
  else
    result FAIL "webapp repo" "no package.json under $CLOUD_REPO_ROOT" "run doctor from a Blueprint-WebApp checkout"
  fi
}

check_pipeline_repo() {
  local root sha shallow=""
  root=$(cloud_pipeline_root)
  if ! cloud_pipeline_present; then
    result FAIL "pipeline repo" "no $CLOUD_PIPELINE_REPO_NAME checkout at $root" \
      "start the session with both repositories (or set BLUEPRINT_PIPELINE_ROOT)"
    return
  fi
  sha=$(git -C "$root" rev-parse --short HEAD 2>/dev/null) || sha="?"
  [ "$(git -C "$root" rev-parse --is-shallow-repository 2>/dev/null)" != true ] || shallow=" (shallow clone)"
  result PASS "pipeline repo" "$root @ $sha$shallow"
}

check_node() {
  local version major
  if ! have node; then
    result FAIL "node" "node is not on PATH" "install Node 20 or newer (the cloud image ships Node 22)"
    return
  fi
  version=$(node --version 2>/dev/null)
  major=${version#v}
  major=${major%%.*}
  case $major in
    '' | *[!0-9]*) result FAIL "node" "unrecognized version '$version'" "install Node 20 or newer" ;;
    *)
      if [ "$major" -ge 20 ]; then
        result PASS "node" "$version"
      else
        result FAIL "node" "$version is older than 20" "install Node 20 or newer"
      fi
      ;;
  esac
}

check_npm() {
  if have npm; then
    result PASS "npm" "$(npm --version 2>/dev/null)"
  else
    result FAIL "npm" "npm is not on PATH" "install Node 20 or newer, which ships npm"
  fi
}

check_node_modules() {
  local pkg missing=""
  for pkg in @playwright/test tsx firebase-admin vitest; do
    [ -d "$CLOUD_REPO_ROOT/node_modules/$pkg" ] || missing="$missing $pkg"
  done
  if [ -z "$missing" ]; then
    result PASS "webapp node_modules" "installed"
  else
    result FAIL "webapp node_modules" "missing:$missing" "$FIX_BOOTSTRAP (runs npm ci)"
  fi
}

check_python3() {
  if have python3; then
    result PASS "python3" "$(python3 --version 2>&1)"
  else
    result FAIL "python3" "python3 is not on PATH" "install Python 3.10-3.12"
  fi
}

check_uv() {
  local uv
  if ! have uv; then
    result FAIL "uv" "uv is not on PATH" "$FIX_BOOTSTRAP, then . ~/.blueprint-cloud/env.sh"
    return
  fi
  uv=$(command -v uv)
  if cloud_uv_version_ok "$uv"; then
    result PASS "uv" "$("$uv" --version 2>/dev/null) ($uv)"
  else
    result FAIL "uv" "$("$uv" --version 2>/dev/null) at $uv; the Pipeline pins $CLOUD_UV_VERSION" \
      ". ~/.blueprint-cloud/env.sh (puts $(cloud_uv_path) first), or $FIX_BOOTSTRAP"
  fi
}

pipeline_python() { printf '%s\n' "${BLUEPRINT_PIPELINE_PYTHON:-$(cloud_venv_python)}"; }

check_pipeline_imports() {
  local root py out rc
  root=$(cloud_pipeline_root)
  py=$(pipeline_python)
  if ! cloud_pipeline_present; then
    result FAIL "pipeline imports" "no Pipeline checkout" "start the session with both repositories"
    return
  fi
  if [ ! -x "$py" ]; then
    result FAIL "pipeline imports" "no virtualenv python at $py" "$FIX_BOOTSTRAP"
    return
  fi
  # shellcheck disable=SC2086 # one argument per module
  out=$(cloud_timeout 50 env PYTHONPATH="$root/src${PYTHONPATH:+:$PYTHONPATH}" MUJOCO_GL=osmesa "$py" -c '
import importlib, sys
failed = []
for name in sys.argv[1:]:
    try:
        importlib.import_module(name)
    except Exception as error:
        failed.append("%s (%s)" % (name, type(error).__name__))
print(", ".join(failed) or "Python %d.%d.%d" % sys.version_info[:3])
sys.exit(1 if failed else 0)
' $PIPELINE_IMPORTS 2>/dev/null)
  rc=$?
  out=$(printf '%s\n' "$out" | tail -n 1)
  case $rc in
    0) result PASS "pipeline imports" "$out: $PIPELINE_IMPORTS" ;;
    124 | 137 | 142) result FAIL "pipeline imports" "timed out after 50s" "$FIX_BOOTSTRAP" ;;
    *) result FAIL "pipeline imports" "failed: ${out:-exit $rc}" \
      "$FIX_BOOTSTRAP; if a module still fails, it needs a dependency outside uv.lock" ;;
  esac
}

check_torch() {
  local py version
  py=$(pipeline_python)
  [ -x "$py" ] || return 0 # the imports check already reports the missing virtualenv
  if version=$(cloud_timeout 30 "$py" -c 'import importlib.metadata as m; print(m.version("torch"))' 2>/dev/null); then
    result PASS "torch (cpu)" "$version"
  else
    result WARN "torch (cpu)" "torch is not installed in the Pipeline virtualenv" \
      "$FIX_BOOTSTRAP (installs torch==$CLOUD_TORCH_VERSION from $CLOUD_TORCH_INDEX_URL)"
  fi
}

check_ffmpeg() {
  local missing=""
  have ffmpeg || missing="$missing ffmpeg"
  have ffprobe || missing="$missing ffprobe"
  if [ -z "$missing" ]; then
    result PASS "ffmpeg/ffprobe" "$(ffmpeg -version 2>/dev/null | head -n 1 | awk '{print $1, $2, $3}')"
  else
    result FAIL "ffmpeg/ffprobe" "missing:$missing" "$FIX_BOOTSTRAP as root (apt-get install ffmpeg)"
  fi
}

check_chromium() {
  local out rc
  if [ ! -d "$CLOUD_REPO_ROOT/node_modules/@playwright/test" ]; then
    result FAIL "chromium launch" "@playwright/test is not installed" "$FIX_BOOTSTRAP"
    return
  fi
  out=$(cd "$CLOUD_REPO_ROOT" && cloud_timeout 45 node -e '
const { chromium } = require("@playwright/test");
const options = { headless: true };
if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) options.executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
(async () => {
  const browser = await chromium.launch(options);
  try {
    const page = await browser.newPage();
    await page.goto("about:blank");
    console.log(browser.version());
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.log(String((error && error.message) || error).split("\n")[0].slice(0, 160));
  process.exit(1);
});
' 2>/dev/null)
  rc=$?
  out=$(printf '%s\n' "$out" | tail -n 1)
  case $rc in
    0) result PASS "chromium launch" "headless Chromium $out loaded about:blank" ;;
    124 | 137 | 142) result FAIL "chromium launch" "timed out after 45s" "npx playwright install --with-deps chromium" ;;
    *) result FAIL "chromium launch" "${out:-launch failed (exit $rc)}" \
      "npx playwright install --with-deps chromium (or $FIX_BOOTSTRAP as root)" ;;
  esac
}

check_https() { # name url
  local name=$1 url=$2 host headers codes rc http connect
  host=${url#*://}
  host=${host%%/*}
  if ! have curl; then
    result FAIL "$name" "curl is not installed" "apt-get install -y curl"
    return
  fi
  headers=$(mktemp "${TMPDIR:-/tmp}/blueprint-doctor.XXXXXX") || return
  codes=$(cloud_timeout 25 curl -sS -o /dev/null -D "$headers" -w '%{http_code} %{http_connect}' \
    --connect-timeout 10 --max-time 20 "$url" 2>/dev/null)
  rc=$?
  http=${codes%% *}
  connect=${codes##* }
  case $http in '' | *[!0-9]*) http=000 ;; esac
  if grep -qiE '^x-deny-reason:[[:space:]]*host_not_allowed' "$headers" 2>/dev/null; then
    result FAIL "$name" "$host is not in this environment's network allowlist (403 host_not_allowed)" \
      "add $host to the environment's allowed domains"
  elif [ "$connect" = 403 ]; then
    result FAIL "$name" "the proxy refused a tunnel to $host (CONNECT 403)" \
      "add $host to the environment's allowed domains"
  elif [ "$http" -ge 200 ] && [ "$http" -lt 400 ]; then
    result PASS "$name" "$url -> HTTP $http"
  elif [ "$http" = 000 ]; then
    result FAIL "$name" "$url unreachable (curl exit $rc)" "check the environment's network access to $host"
  else
    result WARN "$name" "$url -> HTTP $http" "$host answered but not with success; check the service"
  fi
  rm -f "$headers"
}

# Contract with the Pipeline's scripts/operator_door.py: `whoami` prints
# {"name": ..., "scopes": [...]} and exits 0; exit 3 is HTTP 401/403 (the
# credential is missing or not injected); exit 4 is a network error. In cloud
# sessions the proxy injects the token, so none is expected in the VM.
check_operator_door() {
  local client out rc
  client="$(cloud_pipeline_root)/scripts/operator_door.py"
  if [ ! -f "$client" ]; then
    result WARN "operator door" "operator door client not present in this Pipeline checkout" \
      "use a Pipeline checkout that includes scripts/operator_door.py"
    return
  fi
  out=$(cloud_timeout 30 python3 "$client" whoami 2>/dev/null)
  rc=$?
  case $rc in
    0)
      printf '%s' "$out" | python3 -c '
import json, sys
def emit(status, detail, fix=""):
    print("\x1f".join([status, "operator door", detail, fix]))
try:
    data = json.load(sys.stdin)
    name = str(data.get("name") or "?")
    scopes = [str(scope) for scope in data.get("scopes") or []]
except Exception:
    emit("WARN", "whoami exited 0 without the expected JSON", "run scripts/operator_door.py whoami by hand")
    sys.exit(0)
detail = "token %s, scopes %s" % (name, ",".join(scopes) or "none")
missing = [scope for scope in ("read", "operate", "deploy") if scope not in scopes]
if "read" in missing:
    emit("FAIL", detail, "issue the door token with the read scope")
elif missing:
    emit("WARN", detail + " (no " + ",".join(missing) + ": those requests are refused)",
         "issue the door token with scopes read,operate,deploy")
else:
    emit("PASS", detail)
'
      ;;
    3) result FAIL "operator door" "the door refused whoami (HTTP 401/403): the credential is missing or not injected" \
      "add the operator door token as this environment's API credential for paperclip.tryblueprint.io" ;;
    4) result FAIL "operator door" "network error reaching ${BLUEPRINT_OPERATOR_DOOR_URL:-$CLOUD_DOOR_DEFAULT_URL}" \
      "allow paperclip.tryblueprint.io in the environment's network access" ;;
    124 | 137 | 142) result FAIL "operator door" "whoami timed out after 30s" \
      "check network access to paperclip.tryblueprint.io" ;;
    *) result FAIL "operator door" "whoami exited $rc" "run python3 scripts/operator_door.py whoami in the Pipeline repo" ;;
  esac
}

# Prints the service-account result line; returns 0 only for PASS. Reads the
# JSON from the environment inside python so it never reaches argv or output.
check_firebase_service_account() {
  python3 - "$CLOUD_FIREBASE_PROJECT_ID" <<'PY'
import json, os, sys
expected = sys.argv[1]
name = "firebase service account"
def emit(status, detail, fix=""):
    print("\x1f".join([status, name, detail, fix]))
    sys.exit(0 if status == "PASS" else 1)
raw = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON", "")
if not raw.strip():
    emit("FAIL", "FIREBASE_SERVICE_ACCOUNT_JSON is not set",
         "add the %s service-account JSON to the environment's variables" % expected)
try:
    data = json.loads(raw)
except ValueError as error:
    emit("FAIL", "FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON (%s)" % type(error).__name__,
         "paste the key file's JSON exactly as downloaded")
if not isinstance(data, dict):
    emit("FAIL", "FIREBASE_SERVICE_ACCOUNT_JSON is not a JSON object", "paste the key file's JSON exactly as downloaded")
project = str(data.get("project_id") or "")
email = str(data.get("client_email") or "")
if project != expected:
    emit("FAIL", "project_id is %s, expected %s" % (project or "missing", expected),
         "use a service account from the %s project" % expected)
if data.get("type") != "service_account" or not data.get("private_key") or "@" not in email:
    emit("FAIL", "project %s, but the key lacks type, private_key or client_email" % project,
         "download a fresh JSON key for the service account")
emit("PASS", "project=%s client_email=*@%s" % (project, email.split("@", 1)[1]))
PY
}

check_firestore() {
  local out rc line
  if ! check_firebase_service_account >/dev/null 2>&1; then
    result WARN "firestore read" "skipped: no usable FIREBASE_SERVICE_ACCOUNT_JSON" "fix the service account check"
    return
  fi
  if [ ! -x "$CLOUD_REPO_ROOT/node_modules/.bin/tsx" ]; then
    result FAIL "firestore read" "tsx is not installed" "$FIX_BOOTSTRAP"
    return
  fi
  out=$(cd "$CLOUD_REPO_ROOT" && cloud_timeout 45 ./node_modules/.bin/tsx scripts/cloud/firestore-probe.ts 2>/dev/null)
  rc=$?
  line=$(printf '%s\n' "$out" | grep '^firestore-probe ' | tail -n 1)
  line=${line#firestore-probe }
  case $rc in
    0) result PASS "firestore read" "inboundRequests limit(1): $line" ;;
    124 | 137 | 142) result FAIL "firestore read" "timed out after 45s" \
      "check network access to firestore.googleapis.com" ;;
    *) result FAIL "firestore read" "${line:-probe exited $rc}" \
      "check the service account's Firestore access and network access to firestore.googleapis.com" ;;
  esac
}

check_ops_email() {
  local count
  if [ -z "${BLUEPRINT_CLOUD_OPS_EMAIL:-}" ]; then
    result FAIL "ops account allowlist" "BLUEPRINT_CLOUD_OPS_EMAIL is not set" \
      "add the ops account email(s), comma-separated, to the environment's variables"
    return
  fi
  count=$(printf '%s\n' "$BLUEPRINT_CLOUD_OPS_EMAIL" | tr ',' '\n' | grep -c '@')
  if [ "$count" -gt 0 ]; then
    result PASS "ops account allowlist" "$count address(es) configured"
  else
    result FAIL "ops account allowlist" "BLUEPRINT_CLOUD_OPS_EMAIL holds no email address" \
      "set it to the ops account email(s), comma-separated"
  fi
}

check_gh() {
  if ! have gh; then
    result FAIL "gh" "gh is not on PATH" "install the GitHub CLI"
  elif cloud_timeout 20 gh auth status >/dev/null 2>&1; then
    result PASS "gh" "authenticated"
  else
    result FAIL "gh" "gh auth status failed" "authenticate gh (cloud sessions get it through the proxy)"
  fi
}

check_setup_steps() {
  local file name status rc log any=0
  if [ ! -d "$CLOUD_STATE_DIR/steps" ]; then
    result WARN "install record" "no setup or bootstrap record under $CLOUD_STATE_DIR" "$FIX_BOOTSTRAP"
    return
  fi
  for file in "$CLOUD_STATE_DIR"/steps/*.status; do
    [ -f "$file" ] || continue
    name=$(basename "$file" .status)
    status=$(sed -n 's/^status=//p' "$file")
    rc=$(sed -n 's/^rc=//p' "$file")
    log=$(sed -n 's/^log=//p' "$file")
    case $status in
      ok | n/a) ;;
      *)
        any=1
        result WARN "install step $name" "$status (rc $rc, log $log)" "$FIX_BOOTSTRAP"
        ;;
    esac
  done
  [ "$any" = 1 ] || result PASS "install record" "every recorded install step finished"
}

DOCTOR_TMP=""
DOCTOR_COUNT=0
# Runs a check in the background; its lines land in an ordered result file.
doctor_spawn() {
  DOCTOR_COUNT=$((DOCTOR_COUNT + 1))
  ("$@") >"$(printf '%s/%03d' "$DOCTOR_TMP" "$DOCTOR_COUNT")" 2>/dev/null &
}

doctor_usage() {
  sed -n '2,/^set -uo/p' "$DOCTOR_DIR/doctor.sh" | sed '$d' | sed 's/^# \{0,1\}//'
}

doctor_main() {
  local offline=0 file status name detail fix pass=0 warns=0 fails=0
  while [ $# -gt 0 ]; do
    case $1 in
      --offline) offline=1 ;;
      -h | --help)
        doctor_usage
        return 0
        ;;
      *)
        doctor_usage >&2
        return 2
        ;;
    esac
    shift
  done
  cloud_load_env_file
  DOCTOR_TMP=$(mktemp -d "${TMPDIR:-/tmp}/blueprint-doctor.XXXXXX") || return 1
  trap 'rm -rf "$DOCTOR_TMP"' EXIT

  printf 'Blueprint cloud doctor\n'
  printf '  webapp:   %s\n  pipeline: %s\n  state:    %s\n' "$CLOUD_REPO_ROOT" "$(cloud_pipeline_root)" "$CLOUD_STATE_DIR"
  if [ "${CLAUDE_CODE_REMOTE:-}" = true ]; then
    printf '  session:  cloud\n\n'
  else
    printf '  session:  local (CLAUDE_CODE_REMOTE is not true)\n\n'
  fi

  doctor_spawn check_bootstrap_running
  doctor_spawn check_webapp_repo
  doctor_spawn check_pipeline_repo
  doctor_spawn check_node
  doctor_spawn check_npm
  doctor_spawn check_node_modules
  doctor_spawn check_python3
  doctor_spawn check_uv
  doctor_spawn check_pipeline_imports
  doctor_spawn check_torch
  doctor_spawn check_ffmpeg
  doctor_spawn check_chromium
  if [ "$offline" = 1 ]; then
    doctor_spawn result WARN "network checks" "skipped (--offline): site, host, operator door, Firestore, gh" \
      "rerun without --offline"
  else
    doctor_spawn check_https "site reachable" "$SITE_VERSION_URL"
    doctor_spawn check_https "host reachable" "$HOST_VERSION_URL"
    doctor_spawn check_operator_door
  fi
  doctor_spawn check_firebase_service_account
  [ "$offline" = 1 ] || doctor_spawn check_firestore
  doctor_spawn check_ops_email
  [ "$offline" = 1 ] || doctor_spawn check_gh
  doctor_spawn check_setup_steps
  wait

  for file in "$DOCTOR_TMP"/*; do
    [ -s "$file" ] || continue
    while IFS=$'\037' read -r status name detail fix; do
      [ -n "$status" ] || continue
      printf '%-4s  %-24s %s\n' "$status" "$name" "$detail"
      [ -z "$fix" ] || printf '      %-24s fix: %s\n' "" "$fix"
      case $status in
        PASS) pass=$((pass + 1)) ;;
        WARN) warns=$((warns + 1)) ;;
        *) fails=$((fails + 1)) ;;
      esac
    done <"$file"
  done
  printf '\ndoctor: %s pass, %s warn, %s fail\n' "$pass" "$warns" "$fails"
  [ "$fails" -eq 0 ]
}

# Sourcing this file (for tests) defines the checks without running them.
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  doctor_main "$@"
  exit $?
fi
