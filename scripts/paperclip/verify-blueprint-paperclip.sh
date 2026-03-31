#!/usr/bin/env bash
set -euo pipefail

WORKSPACE_ROOT="/Users/nijelhunt_1/workspace"
PAPERCLIP_ENV_FILE="${PAPERCLIP_ENV_FILE:-$WORKSPACE_ROOT/.paperclip-blueprint.env}"

if [ -f "$PAPERCLIP_ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$PAPERCLIP_ENV_FILE"
  set +a
fi

PAPERCLIP_API_URL="${PAPERCLIP_API_URL:-http://127.0.0.1:3101}"
COMPANY_NAME="${COMPANY_NAME:-Blueprint Autonomous Operations}"
PLUGIN_KEY="blueprint.automation"
RUN_SMOKE=0
CLAUDE_LANE_MODE="${BLUEPRINT_PAPERCLIP_CLAUDE_LANE_MODE:-auto}"
VERIFY_CLAUDE="${BLUEPRINT_PAPERCLIP_VERIFY_CLAUDE:-1}"
VERIFY_HERMES="${BLUEPRINT_PAPERCLIP_VERIFY_HERMES:-auto}"
FORCE_CODEX_CLAUDE_LANES="${BLUEPRINT_PAPERCLIP_FORCE_CODEX_CLAUDE_LANES:-0}"
HERMES_INSTRUCTIONS_FILE="/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/blueprint-company/agents/blueprint-chief-of-staff/AGENTS.md"

for arg in "$@"; do
  if [ "$arg" = "--smoke" ]; then
    RUN_SMOKE=1
  fi
done

if [[ "$FORCE_CODEX_CLAUDE_LANES" =~ ^(1|true|yes)$ ]] && [ -z "${BLUEPRINT_PAPERCLIP_VERIFY_CLAUDE:-}" ]; then
  VERIFY_CLAUDE=0
fi

if [[ "$CLAUDE_LANE_MODE" =~ ^codex$ ]] && [ -z "${BLUEPRINT_PAPERCLIP_VERIFY_CLAUDE:-}" ]; then
  VERIFY_CLAUDE=0
fi

paperclip_health() {
  curl -fsS "${PAPERCLIP_API_URL}/api/health" >/dev/null
}

company_json() {
  curl -fsS "${PAPERCLIP_API_URL}/api/companies" \
    | node -e 'let data="";process.stdin.on("data",(chunk)=>data+=chunk);process.stdin.on("end",()=>{const rows=JSON.parse(data);const match=rows.find((row)=>row.name===process.argv[1]);if(!match){process.exit(2);}process.stdout.write(JSON.stringify(match));});' "$COMPANY_NAME"
}

plugin_json() {
  curl -fsS "${PAPERCLIP_API_URL}/api/plugins" \
    | node -e 'let data="";process.stdin.on("data",(chunk)=>data+=chunk);process.stdin.on("end",()=>{const rows=JSON.parse(data);const match=rows.find((row)=>row.pluginKey===process.argv[1]);if(!match){process.exit(2);}process.stdout.write(JSON.stringify(match));});' "$PLUGIN_KEY"
}

plugin_config_json() {
  local plugin_id="$1"
  curl -fsS "${PAPERCLIP_API_URL}/api/plugins/${plugin_id}/config"
}

require_routines() {
  local company_id="$1"
  local routines_json
  routines_json="$(curl -fsS "${PAPERCLIP_API_URL}/api/companies/${company_id}/routines")"
  printf '%s' "$routines_json" | node -e '
    let data="";
    process.stdin.on("data",(chunk)=>data+=chunk);
    process.stdin.on("end",()=>{
      const rows=JSON.parse(data);
      const required=[
        "CEO Daily Review",
        "Chief of Staff Continuous Loop",
        "CTO Cross-Repo Triage",
        "WebApp Autonomy Loop",
        "WebApp Claude Review Loop",
        "Pipeline Autonomy Loop",
        "Pipeline Claude Review Loop",
        "Capture Autonomy Loop",
        "Capture Claude Review Loop",
        "Ops Lead Morning",
        "Ops Lead Afternoon",
        "Intake Agent Hourly",
        "Capture QA Daily",
        "Field Ops Daily",
        "Finance Support Daily",
        "Growth Lead Daily",
        "Growth Lead Weekly",
        "Analytics Daily",
        "Analytics Weekly",
        "Conversion Weekly",
        "Market Intel Daily",
        "Market Intel Weekly",
        "Demand Intel Daily",
        "Demand Intel Weekly",
        "Robot Team Growth Weekly",
        "Robot Team Growth Refresh",
        "Site Operator Partnership Weekly",
        "Site Operator Partnership Refresh",
        "City Demand Weekly",
        "City Demand Refresh"
      ];
      const missing=required.filter((title)=>!rows.find((row)=>row.title===title && row.status==="active"));
      if(missing.length>0){
        console.error(`Missing active routines: ${missing.join(", ")}`);
        process.exit(1);
      }
    });
  '
}

plugin_dashboard() {
  local company_id="$1"
  curl -fsS -X POST \
    -H "Content-Type: application/json" \
    -d "$(node -e 'process.stdout.write(JSON.stringify({companyId:process.argv[1]}));' "$company_id")" \
    "${PAPERCLIP_API_URL}/api/plugins/${PLUGIN_KEY}/data/dashboard"
}

run_test() {
  local company_id="$1"
  local repo_label="$2"
  local adapter_type="$3"
  local payload="$4"
  local result
  result="$(curl -fsS \
    -H "Content-Type: application/json" \
    -d "$payload" \
    "${PAPERCLIP_API_URL}/api/companies/${company_id}/adapters/${adapter_type}/test-environment")"
  printf '%s\n' "$result" | jq --arg repo "$repo_label" --arg adapter "$adapter_type" '{repo:$repo,adapter:$adapter,status,checks:[.checks[]|{code,level,message,detail,hint}]}'
  local status
  status="$(printf '%s' "$result" | jq -r '.status')"
  LAST_TEST_STATUS="$status"
  LAST_TEST_RESULT="$result"
}

assert_workspace_ready() {
  local repo_label="$1"
  local codex_status="$2"
  local claude_status="$3"

  case "$CLAUDE_LANE_MODE" in
    codex)
      [ "$codex_status" = "pass" ] || {
        echo "Verification failed: ${repo_label} requires Codex in forced codex mode." >&2
        return 1
      }
      ;;
    claude)
      [ "$claude_status" = "pass" ] || {
        echo "Verification failed: ${repo_label} requires Claude in forced claude mode." >&2
        return 1
      }
      ;;
    *)
      if [ "$codex_status" != "pass" ] && [ "$claude_status" != "pass" ]; then
        echo "Verification failed: ${repo_label} has neither a healthy Codex nor Claude adapter." >&2
        return 1
      fi
      ;;
  esac
}

should_verify_hermes() {
  case "${VERIFY_HERMES}" in
    1|true|yes)
      return 0
      ;;
    0|false|no)
      return 1
      ;;
    auto|"")
      command -v hermes >/dev/null 2>&1
      ;;
    *)
      echo "Unknown BLUEPRINT_PAPERCLIP_VERIFY_HERMES=${VERIFY_HERMES}; expected auto|0|1" >&2
      return 1
      ;;
  esac
}

hermes_oauth_only_probe_ok() {
  [ "${LAST_TEST_STATUS}" = "pass" ] && return 0
  [ "${LAST_TEST_STATUS}" = "warn" ] || return 1

  printf '%s' "${LAST_TEST_RESULT}" | node -e '
    let data="";
    process.stdin.on("data",(chunk)=>data+=chunk);
    process.stdin.on("end",()=>{
      const payload = JSON.parse(data);
      const checks = Array.isArray(payload.checks) ? payload.checks : [];
      const warnCodes = checks
        .filter((check) => check && check.level === "warn")
        .map((check) => check.code)
        .filter(Boolean);
      const allowedWarns = warnCodes.length === 1 && warnCodes[0] === "hermes_no_api_keys";
      const hasVersion = checks.some((check) => check && check.code === "hermes_version");
      const hasModel = checks.some((check) => check && check.code === "hermes_model_configured");
      process.exit(allowedWarns && hasVersion && hasModel ? 0 : 1);
    });
  '
}

main() {
  paperclip_health
  local company
  company="$(company_json)"
  local company_id
  company_id="$(printf '%s' "$company" | node -e 'let data="";process.stdin.on("data",(chunk)=>data+=chunk);process.stdin.on("end",()=>{const row=JSON.parse(data);process.stdout.write(row.id);});')"
  local plugin
  plugin="$(plugin_json)"
  local plugin_id
  plugin_id="$(printf '%s' "$plugin" | node -e 'let data="";process.stdin.on("data",(chunk)=>data+=chunk);process.stdin.on("end",()=>{const row=JSON.parse(data);process.stdout.write(row.id);});')"
  local plugin_config
  plugin_config="$(plugin_config_json "$plugin_id")"
  local plugin_status
  plugin_status="$(printf '%s' "$plugin" | node -e 'let data="";process.stdin.on("data",(chunk)=>data+=chunk);process.stdin.on("end",()=>{const row=JSON.parse(data);process.stdout.write(row.status);});')"
  local plugin_has_config
  plugin_has_config="$(printf '%s' "$plugin_config" | node -e 'let data="";process.stdin.on("data",(chunk)=>data+=chunk);process.stdin.on("end",()=>{const row=JSON.parse(data);process.stdout.write(row.configJson && typeof row.configJson === "object" ? "yes" : "no");});')"
  [ "$plugin_status" = "ready" ]
  [ "$plugin_has_config" = "yes" ]

  require_routines "$company_id"
  plugin_dashboard "$company_id" >/dev/null

  echo "Running adapter tests across all three Blueprint repos..."

  local webapp_codex webapp_claude pipeline_codex pipeline_claude capture_codex capture_claude
  LAST_TEST_STATUS="fail"
  run_test "$company_id" "Blueprint-WebApp" "codex_local" '{
    "adapterConfig": {
      "cwd": "/Users/nijelhunt_1/workspace/Blueprint-WebApp",
      "model": "gpt-5.3-codex",
      "dangerouslyBypassApprovalsAndSandbox": true
    }
  }'
  webapp_codex="$LAST_TEST_STATUS"
  run_test "$company_id" "BlueprintCapturePipeline" "codex_local" '{
    "adapterConfig": {
      "cwd": "/Users/nijelhunt_1/workspace/BlueprintCapturePipeline",
      "model": "gpt-5.3-codex",
      "dangerouslyBypassApprovalsAndSandbox": true
    }
  }'
  pipeline_codex="$LAST_TEST_STATUS"
  run_test "$company_id" "BlueprintCapture" "codex_local" '{
    "adapterConfig": {
      "cwd": "/Users/nijelhunt_1/workspace/BlueprintCapture",
      "model": "gpt-5.3-codex",
      "dangerouslyBypassApprovalsAndSandbox": true
    }
  }'
  capture_codex="$LAST_TEST_STATUS"

  webapp_claude="skipped"
  pipeline_claude="skipped"
  capture_claude="skipped"
  if [ "$VERIFY_CLAUDE" = "1" ] || [ "$CLAUDE_LANE_MODE" = "auto" ] || [ "$CLAUDE_LANE_MODE" = "claude" ]; then
    echo "Running Claude adapter verification..."
    run_test "$company_id" "Blueprint-WebApp" "claude_local" '{
      "adapterConfig": {
        "cwd": "/Users/nijelhunt_1/workspace/Blueprint-WebApp",
        "model": "claude-sonnet-4-6",
        "dangerouslySkipPermissions": true
      }
    }'
    webapp_claude="$LAST_TEST_STATUS"
    run_test "$company_id" "BlueprintCapturePipeline" "claude_local" '{
      "adapterConfig": {
        "cwd": "/Users/nijelhunt_1/workspace/BlueprintCapturePipeline",
        "model": "claude-sonnet-4-6",
        "dangerouslySkipPermissions": true
      }
    }'
    pipeline_claude="$LAST_TEST_STATUS"
    run_test "$company_id" "BlueprintCapture" "claude_local" '{
      "adapterConfig": {
        "cwd": "/Users/nijelhunt_1/workspace/BlueprintCapture",
        "model": "claude-sonnet-4-6",
        "dangerouslySkipPermissions": true
      }
    }'
    capture_claude="$LAST_TEST_STATUS"
  fi

  assert_workspace_ready "Blueprint-WebApp" "$webapp_codex" "$webapp_claude"
  assert_workspace_ready "BlueprintCapturePipeline" "$pipeline_codex" "$pipeline_claude"
  assert_workspace_ready "BlueprintCapture" "$capture_codex" "$capture_claude"

  if should_verify_hermes; then
    echo "Running Hermes adapter verification for Blueprint-WebApp research/copilot agents..."
    run_test "$company_id" "Blueprint-WebApp" "hermes_local" "{
      \"adapterConfig\": {
        \"cwd\": \"/Users/nijelhunt_1/workspace/Blueprint-WebApp\",
        \"model\": \"gpt-5.4-mini\",
        \"modelReasoningEffort\": \"xhigh\",
        \"instructionsFilePath\": \"${HERMES_INSTRUCTIONS_FILE}\",
        \"timeoutSec\": 1200
      }
    }"
    hermes_oauth_only_probe_ok || {
      echo "Verification failed: Hermes-backed Blueprint-WebApp agents require a healthy hermes_local adapter." >&2
      return 1
    }
  else
    echo "Skipping Hermes adapter verification (set BLUEPRINT_PAPERCLIP_VERIFY_HERMES=1 to require it)."
  fi

  if [ "$RUN_SMOKE" -eq 1 ]; then
    /Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/smoke-blueprint-paperclip-automation.sh
  fi
}

main "$@"
