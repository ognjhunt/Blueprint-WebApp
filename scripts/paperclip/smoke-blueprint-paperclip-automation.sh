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

PAPERCLIP_PUBLIC_URL="${PAPERCLIP_PUBLIC_URL:-http://127.0.0.1:3100}"
COMPANY_NAME="${COMPANY_NAME:-Blueprint Autonomous Operations}"
PLUGIN_KEY="blueprint.automation"
SOURCE_TYPE="smoke-ci"
SOURCE_ID="smoke-$(date +%s)"
FINGERPRINT="${SOURCE_TYPE}:${SOURCE_ID}"

company_id() {
  curl -fsS "${PAPERCLIP_PUBLIC_URL}/api/companies" \
    | node -e 'let data="";process.stdin.on("data",(chunk)=>data+=chunk);process.stdin.on("end",()=>{const rows=JSON.parse(data);const match=rows.find((row)=>row.name===process.argv[1]);if(!match){process.exit(2);}process.stdout.write(match.id);});' "$COMPANY_NAME"
}

dashboard_json() {
  local company_id="$1"
  curl -fsS -X POST \
    -H "Content-Type: application/json" \
    -d "$(node -e 'process.stdout.write(JSON.stringify({companyId:process.argv[1],params:{companyId:process.argv[1]}}));' "$company_id")" \
    "${PAPERCLIP_PUBLIC_URL}/api/plugins/${PLUGIN_KEY}/data/dashboard"
}

mapping_issue_id() {
  local company_id="$1"
  dashboard_json "$company_id" \
    | node -e 'let data="";process.stdin.on("data",(chunk)=>data+=chunk);process.stdin.on("end",()=>{const body=JSON.parse(data).data;const match=(body.sourceMappings||[]).find((row)=>row.externalId===process.argv[1]);if(!match||!match.issueId){process.exit(2);}process.stdout.write(match.issueId);});' "$FINGERPRINT"
}

mapping_hits() {
  local company_id="$1"
  dashboard_json "$company_id" \
    | node -e 'let data="";process.stdin.on("data",(chunk)=>data+=chunk);process.stdin.on("end",()=>{const body=JSON.parse(data).data;const match=(body.sourceMappings||[]).find((row)=>row.externalId===process.argv[1]);process.stdout.write(String(match?.hits ?? 0));});' "$FINGERPRINT"
}

send_ci_webhook() {
  local description="$1"
  local -a headers=(-H "Content-Type: application/json")
  if [ -n "${BLUEPRINT_PAPERCLIP_CI_SHARED_SECRET:-}" ]; then
    headers+=(-H "Authorization: Bearer ${BLUEPRINT_PAPERCLIP_CI_SHARED_SECRET}")
  fi

  curl -fsS -X POST \
    "${headers[@]}" \
    -d "$(node -e 'process.stdout.write(JSON.stringify({sourceType:process.argv[1],sourceId:process.argv[2],projectName:"blueprint-webapp",assignee:"webapp-codex",title:"Smoke CI issue",description:process.argv[3],status:"todo",priority:"high"}));' "$SOURCE_TYPE" "$SOURCE_ID" "$description")" \
    "${PAPERCLIP_PUBLIC_URL}/api/plugins/${PLUGIN_KEY}/webhooks/ci" >/dev/null
}

main() {
  local company
  company="$(company_id)"

  send_ci_webhook "Initial smoke failure"
  local issue_id
  issue_id="$(mapping_issue_id "$company")"

  send_ci_webhook "Repeat smoke failure for dedupe validation"
  local issue_id_after
  issue_id_after="$(mapping_issue_id "$company")"
  local hits
  hits="$(mapping_hits "$company")"

  if [ "$issue_id" != "$issue_id_after" ]; then
    echo "Smoke failed: dedupe created a new issue instead of reusing ${issue_id}" >&2
    exit 1
  fi

  if [ "$hits" -lt 2 ]; then
    echo "Smoke failed: expected dedupe hit count >= 2, got ${hits}" >&2
    exit 1
  fi

  local blocker_issue
  blocker_issue="$(
    curl -fsS -X POST \
      -H "Content-Type: application/json" \
      -d "$(node -e 'process.stdout.write(JSON.stringify({companyId:process.argv[1],params:{companyId:process.argv[1],parentIssueId:process.argv[2],title:"Smoke blocker follow-up",description:"Smoke script created a linked blocker issue.",projectName:"blueprint-webapp",assignee:"webapp-claude",priority:"high"}}));' "$company" "$issue_id")" \
      "${PAPERCLIP_PUBLIC_URL}/api/plugins/${PLUGIN_KEY}/actions/report-blocker" \
      | node -e 'let data="";process.stdin.on("data",(chunk)=>data+=chunk);process.stdin.on("end",()=>{const body=JSON.parse(data).data;process.stdout.write(body.id);});'
  )"

  curl -fsS -X POST \
    -H "Content-Type: application/json" \
    -d "$(node -e 'process.stdout.write(JSON.stringify({companyId:process.argv[1],params:{companyId:process.argv[1],sourceType:process.argv[2],sourceId:process.argv[3],resolutionStatus:"done",comment:"Smoke script resolved the CI issue."}}));' "$company" "$SOURCE_TYPE" "$SOURCE_ID")" \
    "${PAPERCLIP_PUBLIC_URL}/api/plugins/${PLUGIN_KEY}/actions/resolve-work-item" >/dev/null

  local final_status
  final_status="$(
    curl -fsS "${PAPERCLIP_PUBLIC_URL}/api/issues/${issue_id}" \
      | node -e 'let data="";process.stdin.on("data",(chunk)=>data+=chunk);process.stdin.on("end",()=>{const body=JSON.parse(data);process.stdout.write(body.status);});'
  )"

  if [ "$final_status" != "done" ]; then
    echo "Smoke failed: expected ${issue_id} to be done, got ${final_status}" >&2
    exit 1
  fi

  echo "Smoke passed"
  echo "company id: ${company}"
  echo "managed issue: ${issue_id}"
  echo "follow-up blocker: ${blocker_issue}"
  echo "dedupe hits: ${hits}"
}

main "$@"
