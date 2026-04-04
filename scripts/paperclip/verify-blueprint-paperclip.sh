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

PAPERCLIP_API_URL="${PAPERCLIP_API_URL:-http://127.0.0.1:3100}"
COMPANY_NAME="${COMPANY_NAME:-Blueprint Autonomous Operations}"
PLUGIN_KEY="blueprint.automation"
RUN_SMOKE=0
VERIFY_CLAUDE="${BLUEPRINT_PAPERCLIP_VERIFY_CLAUDE:-1}"

for arg in "$@"; do
  if [ "$arg" = "--smoke" ]; then
    RUN_SMOKE=1
  fi
done

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
        "Market Intel Weekly"
      ];
      const expectedPolicies = {
        "CEO Daily Review": { concurrencyPolicy: "coalesce_if_active", catchUpPolicy: "skip_missed" },
        "CTO Cross-Repo Triage": { concurrencyPolicy: "coalesce_if_active", catchUpPolicy: "skip_missed" },
        "WebApp Autonomy Loop": { concurrencyPolicy: "coalesce_if_active", catchUpPolicy: "skip_missed" },
        "WebApp Claude Review Loop": { concurrencyPolicy: "coalesce_if_active", catchUpPolicy: "skip_missed" },
        "Pipeline Autonomy Loop": { concurrencyPolicy: "coalesce_if_active", catchUpPolicy: "skip_missed" },
        "Pipeline Claude Review Loop": { concurrencyPolicy: "coalesce_if_active", catchUpPolicy: "skip_missed" },
        "Capture Autonomy Loop": { concurrencyPolicy: "coalesce_if_active", catchUpPolicy: "skip_missed" },
        "Capture Claude Review Loop": { concurrencyPolicy: "coalesce_if_active", catchUpPolicy: "skip_missed" },
        "Ops Lead Morning": { concurrencyPolicy: "coalesce_if_active", catchUpPolicy: "skip_missed" },
        "Ops Lead Afternoon": { concurrencyPolicy: "coalesce_if_active", catchUpPolicy: "skip_missed" },
        "Intake Agent Hourly": { concurrencyPolicy: "coalesce_if_active", catchUpPolicy: "skip_missed" },
        "Capture QA Daily": { concurrencyPolicy: "coalesce_if_active", catchUpPolicy: "skip_missed" },
        "Field Ops Daily": { concurrencyPolicy: "coalesce_if_active", catchUpPolicy: "skip_missed" },
        "Finance Support Daily": { concurrencyPolicy: "coalesce_if_active", catchUpPolicy: "skip_missed" },
        "Growth Lead Daily": { concurrencyPolicy: "coalesce_if_active", catchUpPolicy: "skip_missed" },
        "Growth Lead Weekly": { concurrencyPolicy: "coalesce_if_active", catchUpPolicy: "skip_missed" },
        "Analytics Daily": { concurrencyPolicy: "coalesce_if_active", catchUpPolicy: "skip_missed" },
        "Analytics Weekly": { concurrencyPolicy: "coalesce_if_active", catchUpPolicy: "skip_missed" },
        "Conversion Weekly": { concurrencyPolicy: "coalesce_if_active", catchUpPolicy: "skip_missed" },
        "Market Intel Daily": { concurrencyPolicy: "coalesce_if_active", catchUpPolicy: "skip_missed" },
        "Market Intel Weekly": { concurrencyPolicy: "coalesce_if_active", catchUpPolicy: "skip_missed" }
      };
      const missing=required.filter((title)=>!rows.find((row)=>row.title===title && row.status==="active"));
      if(missing.length>0){
        console.error(`Missing active routines: ${missing.join(", ")}`);
        process.exit(1);
      }
      const policyMismatches=required
        .map((title)=>({
          title,
          actual: rows.find((row)=>row.title===title && row.status==="active"),
        }))
        .filter(({title, actual})=>{
          const expected = expectedPolicies[title];
          return Boolean(actual && expected && (
            actual.concurrencyPolicy !== expected.concurrencyPolicy ||
            actual.catchUpPolicy !== expected.catchUpPolicy
          ));
        });
      if(policyMismatches.length>0){
        console.error(
          "Routine policy mismatches:",
          policyMismatches.map(({title, actual}) => `${title} (concurrency=${actual.concurrencyPolicy}, catchUp=${actual.catchUpPolicy})`).join(", ")
        );
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
  printf '%s\n' "$result" | jq --arg repo "$repo_label" --arg adapter "$adapter_type" '{repo:$repo,adapter:$adapter,status,checks:[.checks[]|{code,level,message}]}'
  local status
  status="$(printf '%s' "$result" | jq -r '.status')"
  [ "$status" = "pass" ]
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

  echo "Running Codex adapter tests across all three Blueprint repos..."

  run_test "$company_id" "Blueprint-WebApp" "codex_local" '{
    "adapterConfig": {
      "cwd": "/Users/nijelhunt_1/workspace/Blueprint-WebApp",
      "model": "gpt-5.3-codex",
      "dangerouslyBypassApprovalsAndSandbox": true
    }
  }'
  run_test "$company_id" "BlueprintCapturePipeline" "codex_local" '{
    "adapterConfig": {
      "cwd": "/Users/nijelhunt_1/workspace/BlueprintCapturePipeline",
      "model": "gpt-5.3-codex",
      "dangerouslyBypassApprovalsAndSandbox": true
    }
  }'
  run_test "$company_id" "BlueprintCapture" "codex_local" '{
    "adapterConfig": {
      "cwd": "/Users/nijelhunt_1/workspace/BlueprintCapture",
      "model": "gpt-5.3-codex",
      "dangerouslyBypassApprovalsAndSandbox": true
    }
  }'
  if [ "$VERIFY_CLAUDE" = "1" ]; then
    echo "Running optional Claude adapter verification..."
    run_test "$company_id" "Blueprint-WebApp" "claude_local" '{
      "adapterConfig": {
        "cwd": "/Users/nijelhunt_1/workspace/Blueprint-WebApp",
        "model": "claude-sonnet-4-6",
        "dangerouslySkipPermissions": true
      }
    }'
    run_test "$company_id" "BlueprintCapturePipeline" "claude_local" '{
      "adapterConfig": {
        "cwd": "/Users/nijelhunt_1/workspace/BlueprintCapturePipeline",
        "model": "claude-sonnet-4-6",
        "dangerouslySkipPermissions": true
      }
    }'
    run_test "$company_id" "BlueprintCapture" "claude_local" '{
      "adapterConfig": {
        "cwd": "/Users/nijelhunt_1/workspace/BlueprintCapture",
        "model": "claude-sonnet-4-6",
        "dangerouslySkipPermissions": true
      }
    }'
  fi

  if [ "$RUN_SMOKE" -eq 1 ]; then
    /Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/smoke-blueprint-paperclip-automation.sh
  fi
}

main "$@"
