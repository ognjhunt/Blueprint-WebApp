#!/usr/bin/env bash
set -euo pipefail

PAPERCLIP_PUBLIC_URL="${PAPERCLIP_PUBLIC_URL:-http://127.0.0.1:3100}"
COMPANY_NAME="${COMPANY_NAME:-Blueprint Autonomous Operations}"

paperclip_health() {
  curl -fsS "${PAPERCLIP_PUBLIC_URL}/api/health" >/dev/null
}

company_json() {
  curl -fsS "${PAPERCLIP_PUBLIC_URL}/api/companies" \
    | node -e 'let data="";process.stdin.on("data",(chunk)=>data+=chunk);process.stdin.on("end",()=>{const rows=JSON.parse(data);const match=rows.find((row)=>row.name===process.argv[1]);if(!match){process.exit(2);}process.stdout.write(JSON.stringify(match));});' "$COMPANY_NAME"
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
    "${PAPERCLIP_PUBLIC_URL}/api/companies/${company_id}/adapters/${adapter_type}/test-environment")"
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

  echo "Running Codex + Claude adapter tests across all three Blueprint repos..."

  run_test "$company_id" "Blueprint-WebApp" "codex_local" '{
    "adapterConfig": {
      "cwd": "/Users/nijelhunt_1/workspace/Blueprint-WebApp",
      "model": "gpt-5.3-codex",
      "dangerouslyBypassApprovalsAndSandbox": true
    }
  }'
  run_test "$company_id" "Blueprint-WebApp" "claude_local" '{
    "adapterConfig": {
      "cwd": "/Users/nijelhunt_1/workspace/Blueprint-WebApp",
      "model": "claude-sonnet-4-6",
      "dangerouslySkipPermissions": true
    }
  }'
  run_test "$company_id" "BlueprintCapturePipeline" "codex_local" '{
    "adapterConfig": {
      "cwd": "/Users/nijelhunt_1/workspace/BlueprintCapturePipeline",
      "model": "gpt-5.3-codex",
      "dangerouslyBypassApprovalsAndSandbox": true
    }
  }'
  run_test "$company_id" "BlueprintCapturePipeline" "claude_local" '{
    "adapterConfig": {
      "cwd": "/Users/nijelhunt_1/workspace/BlueprintCapturePipeline",
      "model": "claude-sonnet-4-6",
      "dangerouslySkipPermissions": true
    }
  }'
  run_test "$company_id" "BlueprintCapture" "codex_local" '{
    "adapterConfig": {
      "cwd": "/Users/nijelhunt_1/workspace/BlueprintCapture",
      "model": "gpt-5.3-codex",
      "dangerouslyBypassApprovalsAndSandbox": true
    }
  }'
  run_test "$company_id" "BlueprintCapture" "claude_local" '{
    "adapterConfig": {
      "cwd": "/Users/nijelhunt_1/workspace/BlueprintCapture",
      "model": "claude-sonnet-4-6",
      "dangerouslySkipPermissions": true
    }
  }'
}

main "$@"
