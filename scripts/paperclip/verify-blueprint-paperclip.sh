#!/usr/bin/env bash
set -euo pipefail

WORKSPACE_ROOT="/Users/nijelhunt_1/workspace"
PAPERCLIP_ENV_FILE="${PAPERCLIP_ENV_FILE:-$WORKSPACE_ROOT/.paperclip-blueprint.env}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
CONNECTOR_RUNBOOK_PATH="$REPO_ROOT/docs/paperclip-connector-recovery-runbook.md"
PAPERCLIP_COMPANY_CONFIG_PATH="$REPO_ROOT/ops/paperclip/blueprint-company/.paperclip.yaml"

# shellcheck source=./paperclip-api.sh
source "$SCRIPT_DIR/paperclip-api.sh"

if [ -f "$PAPERCLIP_ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$PAPERCLIP_ENV_FILE"
  set +a
fi

PAPERCLIP_HOST="${PAPERCLIP_HOST:-127.0.0.1}"
PAPERCLIP_PORT="${PAPERCLIP_PORT:-3100}"
PAPERCLIP_API_URL="${PAPERCLIP_API_URL:-http://${PAPERCLIP_HOST}:${PAPERCLIP_PORT}}"
COMPANY_NAME="${COMPANY_NAME:-Blueprint Autonomous Operations}"
PLUGIN_KEY="blueprint.automation"
RUN_SMOKE=0
CLAUDE_LANE_MODE="${BLUEPRINT_PAPERCLIP_CLAUDE_LANE_MODE:-auto}"
VERIFY_CLAUDE="${BLUEPRINT_PAPERCLIP_VERIFY_CLAUDE:-1}"
VERIFY_HERMES="${BLUEPRINT_PAPERCLIP_VERIFY_HERMES:-auto}"
VERIFY_OPENCODE="${BLUEPRINT_PAPERCLIP_VERIFY_OPENCODE:-auto}"
OPENCODE_PRIMARY_MODEL="${BLUEPRINT_PAPERCLIP_OPENCODE_PRIMARY_MODEL:-google/gemini-2.5-flash}"
FORCE_CODEX_CLAUDE_LANES="${BLUEPRINT_PAPERCLIP_FORCE_CODEX_CLAUDE_LANES:-0}"
HERMES_INSTRUCTIONS_FILE="/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/blueprint-company/agents/blueprint-chief-of-staff/AGENTS.md"
AGENT_KIT_VALIDATOR="${SCRIPT_DIR}/validate-agent-kits.sh"

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

if [ -z "${BLUEPRINT_PAPERCLIP_VERIFY_CLAUDE:-}" ] \
  && [ -f "$PAPERCLIP_COMPANY_CONFIG_PATH" ] \
  && ! rg -q 'type: claude_local' "$PAPERCLIP_COMPANY_CONFIG_PATH"; then
  VERIFY_CLAUDE=0
fi

paperclip_health() {
  paperclip_api_health "$PAPERCLIP_API_URL"
}

fetch_api_json() {
  local path="$1"
  paperclip_api_fetch_json "$PAPERCLIP_API_URL" "$path" "Blueprint Paperclip API"
}

company_json() {
  fetch_api_json "/api/companies" \
    | node -e 'let data="";process.stdin.on("data",(chunk)=>data+=chunk);process.stdin.on("end",()=>{const rows=JSON.parse(data);const match=rows.find((row)=>row.name===process.argv[1]);if(!match){process.exit(2);}process.stdout.write(JSON.stringify(match));});' "$COMPANY_NAME"
}

plugin_json() {
  fetch_api_json "/api/plugins" \
    | node -e 'let data="";process.stdin.on("data",(chunk)=>data+=chunk);process.stdin.on("end",()=>{const rows=JSON.parse(data);const match=rows.find((row)=>row.pluginKey===process.argv[1]);if(!match){process.exit(2);}process.stdout.write(JSON.stringify(match));});' "$PLUGIN_KEY"
}

plugin_config_json() {
  local plugin_id="$1"
  fetch_api_json "/api/plugins/${plugin_id}/config"
}

require_routines() {
  local company_id="$1"
  local routines_file
  routines_file="$(mktemp)"
  fetch_api_json "/api/companies/${company_id}/routines" >"$routines_file"
  local node_status=0
  if ! node --input-type=module - "$REPO_ROOT/ops/paperclip/blueprint-company/.paperclip.yaml" "$routines_file" "$PAPERCLIP_API_URL" <<'NODE'
    import fs from "node:fs";
    import { createRequire } from "node:module";
    import { pathToFileURL } from "node:url";

    const configPath = process.argv[2];
    const routinesPath = process.argv[3];
    const apiBaseUrl = process.argv[4];
    const require = createRequire(pathToFileURL(configPath).href);
    const yaml = require("js-yaml");

    const ROUTINE_TITLE_OVERRIDES = {
      "ceo-daily-review": "CEO Daily Review",
      "chief-of-staff-continuous-loop": "Chief of Staff Continuous Loop",
      "cto-cross-repo-triage": "CTO Cross-Repo Triage",
      "webapp-autonomy-loop": "WebApp Autonomy Loop",
      "webapp-review-loop": "WebApp Review Loop",
      "pipeline-autonomy-loop": "Pipeline Autonomy Loop",
      "pipeline-review-loop": "Pipeline Review Loop",
      "capture-autonomy-loop": "Capture Autonomy Loop",
      "capture-review-loop": "Capture Review Loop",
      "ops-lead-morning": "Ops Lead Morning",
      "ops-lead-afternoon": "Ops Lead Afternoon",
      "intake-agent-hourly": "Intake Agent Hourly",
      "capture-qa-daily": "Capture QA Daily",
      "field-ops-daily": "Field Ops Daily",
      "finance-support-daily": "Finance Support Daily",
      "growth-lead-daily": "Growth Lead Daily",
      "growth-lead-weekly": "Growth Lead Weekly",
      "analytics-daily": "Analytics Daily",
      "analytics-weekly": "Analytics Weekly",
      "founder-morning-brief": "Founder Morning Brief",
      "founder-daily-accountability-report": "Founder Daily Accountability Report",
      "founder-eod-brief": "Founder EoD Brief",
      "founder-friday-operating-recap": "Founder Friday Operating Recap",
      "founder-weekly-gaps-report": "Founder Weekly Gaps Report",
      "notion-manager-reconcile-sweep": "Notion Manager Reconcile Sweep",
      "notion-manager-stale-audit": "Notion Manager Stale Audit",
      "notion-manager-weekly-structure-sweep": "Notion Manager Weekly Structure Sweep",
      "investor-relations-monthly": "Investor Relations Monthly",
      "community-updates-weekly": "Community Updates Weekly",
      "conversion-weekly": "Conversion Weekly",
      "market-intel-daily": "Market Intel Daily",
      "market-intel-weekly": "Market Intel Weekly",
      "supply-intel-daily": "Supply Intel Daily",
      "supply-intel-weekly": "Supply Intel Weekly",
      "capturer-growth-weekly": "Capturer Growth Weekly",
      "capturer-growth-refresh": "Capturer Growth Refresh",
      "city-launch-weekly": "City Launch Weekly",
      "city-launch-refresh": "City Launch Refresh",
      "demand-intel-daily": "Demand Intel Daily",
      "demand-intel-weekly": "Demand Intel Weekly",
      "robot-team-growth-weekly": "Robot Team Growth Weekly",
      "robot-team-growth-refresh": "Robot Team Growth Refresh",
      "site-operator-partnership-weekly": "Site Operator Partnership Weekly",
      "site-operator-partnership-refresh": "Site Operator Partnership Refresh",
      "city-demand-weekly": "City Demand Weekly",
      "city-demand-refresh": "City Demand Refresh",
      "solutions-engineering-active-delivery-review": "Solutions Engineering Active Delivery Review",
      "security-procurement-active-reviews": "Security Procurement Active Reviews",
      "revenue-ops-pricing-weekly": "Revenue Ops Pricing Weekly",
    };

    function titleizeToken(token) {
      const overrides = { ceo: "CEO", cto: "CTO", qa: "QA", webapp: "WebApp" };
      return overrides[token] ?? `${token.charAt(0).toUpperCase()}${token.slice(1)}`;
    }

    function titleizeRoutineKey(routineKey) {
      return ROUTINE_TITLE_OVERRIDES[routineKey]
        ?? routineKey.split("-").map(titleizeToken).join(" ");
    }

    const liveRows = JSON.parse(fs.readFileSync(routinesPath, "utf8"));
    const config = yaml.load(fs.readFileSync(configPath, "utf8"));
    const expectedRoutines = Object.entries(config.routines ?? {}).flatMap(([routineKey, routineConfig]) => {
      const scheduleTrigger = Array.isArray(routineConfig?.triggers)
        ? routineConfig.triggers.find((trigger) => trigger.kind === "schedule" && typeof trigger.cronExpression === "string")
        : null;
      if (!scheduleTrigger) return [];
      return [{
        title: titleizeRoutineKey(routineKey),
        expectedStatus: routineConfig?.status === "paused" ? "paused" : "active",
        cronExpression: scheduleTrigger.cronExpression,
        timezone: scheduleTrigger.timezone ?? "America/New_York",
      }];
    });

    const failures = [];
    const routineDetailCache = new Map();

    async function fetchRoutineDetail(routineId) {
      if (!routineDetailCache.has(routineId)) {
        const request = fetch(`${apiBaseUrl}/api/routines/${routineId}`)
          .then(async (response) => {
            if (!response.ok) {
              const text = await response.text();
              throw new Error(`GET /api/routines/${routineId} failed: ${response.status} ${text}`);
            }
            return response.json();
          });
        routineDetailCache.set(routineId, request);
      }
      return routineDetailCache.get(routineId);
    }

    for (const expected of expectedRoutines) {
      const matches = liveRows.filter((row) => row.title === expected.title);
      if (matches.length === 0) {
        failures.push(`Missing routine: ${expected.title}`);
        continue;
      }

      const activeMatches = matches.filter((row) => row.status === "active");
      const detailMatches = await Promise.all(matches.map(async (row) => ({
        row,
        detail: await fetchRoutineDetail(row.id),
      })));
      const enabledScheduleTriggers = detailMatches.flatMap(({ row, detail }) =>
        (detail?.triggers ?? []).filter((trigger) => trigger.kind === "schedule" && trigger.enabled !== false)
          .map((trigger) => ({ row, trigger })),
      );

      if (expected.expectedStatus === "active") {
        if (activeMatches.length !== 1) {
          failures.push(`${expected.title} should have exactly one active routine, found ${activeMatches.length}`);
        }
        if (enabledScheduleTriggers.length !== 1) {
          failures.push(`${expected.title} should have exactly one enabled schedule trigger, found ${enabledScheduleTriggers.length}`);
        } else {
          const [{ trigger }] = enabledScheduleTriggers;
          if (trigger.cronExpression !== expected.cronExpression || trigger.timezone !== expected.timezone) {
            failures.push(
              `${expected.title} trigger drifted: expected ${expected.cronExpression} ${expected.timezone}, got ${trigger.cronExpression ?? "null"} ${trigger.timezone ?? "null"}`,
            );
          }
        }
      } else {
        if (activeMatches.length !== 0) {
          failures.push(`${expected.title} should be paused, found ${activeMatches.length} active routine(s)`);
        }
        if (enabledScheduleTriggers.length !== 0) {
          failures.push(`${expected.title} should have zero enabled schedule triggers while paused, found ${enabledScheduleTriggers.length}`);
        }
      }
    }

    if (failures.length > 0) {
      console.error(failures.join("\n"));
      process.exit(1);
    }
NODE
  then
    node_status=$?
  fi
  rm -f "$routines_file"
  return "$node_status"
}

plugin_dashboard() {
  local company_id="$1"
  curl -fsS -X POST \
    -H "Content-Type: application/json" \
    -d "$(node -e 'process.stdout.write(JSON.stringify({companyId:process.argv[1]}));' "$company_id")" \
    "${PAPERCLIP_API_URL}/api/plugins/${PLUGIN_KEY}/data/dashboard"
}

assert_founder_report_guardrails() {
  local founder_script="tsx scripts/paperclip/chief-of-staff-founder-report.ts --issue-id <current-issue-id>"
  local chief_of_staff_agents="$REPO_ROOT/ops/paperclip/blueprint-company/agents/blueprint-chief-of-staff/AGENTS.md"
  local chief_of_staff_heartbeat="$REPO_ROOT/ops/paperclip/blueprint-company/agents/blueprint-chief-of-staff/Heartbeat.md"
  local founder_tasks=(
    "$REPO_ROOT/ops/paperclip/blueprint-company/tasks/founder-morning-brief/TASK.md"
    "$REPO_ROOT/ops/paperclip/blueprint-company/tasks/founder-daily-accountability-report/TASK.md"
    "$REPO_ROOT/ops/paperclip/blueprint-company/tasks/founder-eod-brief/TASK.md"
    "$REPO_ROOT/ops/paperclip/blueprint-company/tasks/founder-friday-operating-recap/TASK.md"
    "$REPO_ROOT/ops/paperclip/blueprint-company/tasks/founder-weekly-gaps-report/TASK.md"
  )

  grep -Fq "$founder_script" "$chief_of_staff_agents" || {
    echo "Verification failed: chief-of-staff AGENTS.md no longer hard-forces the founder-report fallback script." >&2
    return 1
  }

  grep -Fq "do not browse the queue" "$chief_of_staff_agents" || {
    echo "Verification failed: chief-of-staff AGENTS.md is missing the founder-report no-discovery guardrail." >&2
    return 1
  }

  grep -Fq "$founder_script" "$chief_of_staff_heartbeat" || {
    echo "Verification failed: chief-of-staff Heartbeat.md no longer points founder-report issues straight to the fallback script." >&2
    return 1
  }

  for task_file in "${founder_tasks[@]}"; do
    grep -Fq "Execution rule:" "$task_file" || {
      echo "Verification failed: ${task_file} is missing a founder-report execution rule block." >&2
      return 1
    }
    grep -Fq "$founder_script" "$task_file" || {
      echo "Verification failed: ${task_file} no longer requires the founder-report fallback script first." >&2
      return 1
    }
  done
}

print_connector_runbook_hint() {
  echo "See ${CONNECTOR_RUNBOOK_PATH} for the connector recovery runbook." >&2
}

assert_connector_prereqs() {
  local missing_github=()
  [ -n "${BLUEPRINT_PAPERCLIP_GITHUB_OWNER:-}" ] || missing_github+=("BLUEPRINT_PAPERCLIP_GITHUB_OWNER")
  [ -n "${BLUEPRINT_PAPERCLIP_GITHUB_TOKEN:-}" ] || missing_github+=("BLUEPRINT_PAPERCLIP_GITHUB_TOKEN")
  [ -n "${BLUEPRINT_PAPERCLIP_GITHUB_WEBHOOK_SECRET:-}" ] || missing_github+=("BLUEPRINT_PAPERCLIP_GITHUB_WEBHOOK_SECRET")

  if [ "${#missing_github[@]}" -gt 0 ]; then
    echo "Verification failed: GitHub connector prerequisites are missing (${missing_github[*]})." >&2
    echo "This is a connector/auth configuration problem, not generic Paperclip runtime instability." >&2
    print_connector_runbook_hint
    return 1
  fi

  local has_calendar_creds=0
  if [ -n "${FIREBASE_SERVICE_ACCOUNT_JSON:-}" ] || [ -n "${GOOGLE_APPLICATION_CREDENTIALS:-}" ]; then
    has_calendar_creds=1
  fi
  if [ -n "${GOOGLE_CLIENT_EMAIL:-}" ] && [ -n "${GOOGLE_PRIVATE_KEY:-}" ]; then
    has_calendar_creds=1
  fi

  if [ "$has_calendar_creds" -ne 1 ] || [ -z "${GOOGLE_CALENDAR_ID:-}" ]; then
    echo "WARNING: Calendar-backed field-ops prerequisites are incomplete." >&2
    echo "Set GOOGLE_CALENDAR_ID plus Google service-account credentials before treating field-ops verification failures as runtime instability." >&2
    print_connector_runbook_hint
  fi

  echo "Connector prerequisite check passed for GitHub secrets." >&2
  echo "Manual runtime step still required: re-auth the Claude GitHub connector and claude.ai Google Calendar connector, then run the targeted checks in the runbook." >&2
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

should_verify_opencode() {
  case "${VERIFY_OPENCODE}" in
    1|true|yes)
      return 0
      ;;
    0|false|no)
      return 1
      ;;
    auto|"")
      command -v opencode >/dev/null 2>&1
      ;;
    *)
      echo "Unknown BLUEPRINT_PAPERCLIP_VERIFY_OPENCODE=${VERIFY_OPENCODE}; expected auto|0|1" >&2
      return 1
      ;;
  esac
}

# opencode_local probe is non-fatal: pass or warn (e.g. opencode_no_zen_key) are both acceptable.
# We only fail if the status is explicitly "fail" AND the user has set VERIFY_OPENCODE=1.
opencode_probe_acceptable() {
  [ "${LAST_TEST_STATUS}" = "pass" ] && return 0
  [ "${LAST_TEST_STATUS}" = "warn" ] && return 0
  return 1
}

main() {
  "$AGENT_KIT_VALIDATOR"
  assert_founder_report_guardrails
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
  assert_connector_prereqs

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

  if should_verify_opencode; then
    echo "Running OpenCode adapter verification (Tier 3 fallback — Google Gemini 2.5 Flash + OpenRouter)..."
    run_test "$company_id" "Blueprint-WebApp" "opencode_local" "{
      \"adapterConfig\": {
        \"cwd\": \"/Users/nijelhunt_1/workspace/Blueprint-WebApp\",
        \"model\": \"${OPENCODE_PRIMARY_MODEL}\",
        \"dangerouslySkipPermissions\": true,
        \"timeoutSec\": 1200
      }
    }"
    if opencode_probe_acceptable; then
      echo "OpenCode adapter: ${LAST_TEST_STATUS} — Tier 3 fallback is available."
    else
      if [ "${VERIFY_OPENCODE}" = "1" ]; then
        echo "Verification failed: opencode_local probe returned ${LAST_TEST_STATUS}. Install OpenCode or set BLUEPRINT_PAPERCLIP_VERIFY_OPENCODE=0 to skip." >&2
        return 1
      else
        echo "WARNING: OpenCode adapter probe returned ${LAST_TEST_STATUS}. Tier 3 fallback may be unavailable (set BLUEPRINT_PAPERCLIP_VERIFY_OPENCODE=1 to require it)."
      fi
    fi
  else
    echo "Skipping OpenCode adapter verification (install opencode CLI or set BLUEPRINT_PAPERCLIP_VERIFY_OPENCODE=1 to enable)."
  fi

  if [ "$RUN_SMOKE" -eq 1 ]; then
    /Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/smoke-blueprint-paperclip-automation.sh
  fi
}

main "$@"
