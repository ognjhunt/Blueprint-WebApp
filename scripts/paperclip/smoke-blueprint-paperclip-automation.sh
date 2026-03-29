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
PAPERCLIP_PUBLIC_URL="${PAPERCLIP_PUBLIC_URL:-$PAPERCLIP_API_URL}"
PAPERCLIP_SMOKE_URL="${PAPERCLIP_SMOKE_URL:-$PAPERCLIP_API_URL}"
COMPANY_NAME="${COMPANY_NAME:-Blueprint Autonomous Operations}"
PLUGIN_KEY="blueprint.automation"
SOURCE_TYPE="smoke-ci"
SOURCE_ID="smoke-$(date +%s)"
FINGERPRINT="${SOURCE_TYPE}:${SOURCE_ID}"
OPS_FIRESTORE_ID="smoke-request-${SOURCE_ID}"
OPS_FIRESTORE_FINGERPRINT="ops-firestore:inbound_requests:${OPS_FIRESTORE_ID}"
OPS_STRIPE_ID="evt_smoke_${SOURCE_ID}"
OPS_STRIPE_FINGERPRINT="ops-stripe:${OPS_STRIPE_ID}"
OPS_SUPPORT_ID="support-${SOURCE_ID}"
OPS_SUPPORT_FINGERPRINT="ops-support:${OPS_SUPPORT_ID}"

company_id() {
  curl -fsS "${PAPERCLIP_SMOKE_URL}/api/companies" \
    | node -e 'let data="";process.stdin.on("data",(chunk)=>data+=chunk);process.stdin.on("end",()=>{const rows=JSON.parse(data);const match=rows.find((row)=>row.name===process.argv[1]);if(!match){process.exit(2);}process.stdout.write(match.id);});' "$COMPANY_NAME"
}

dashboard_json() {
  local company_id="$1"
  curl -fsS -X POST \
    -H "Content-Type: application/json" \
    -d "$(node -e 'process.stdout.write(JSON.stringify({companyId:process.argv[1],params:{companyId:process.argv[1]}}));' "$company_id")" \
    "${PAPERCLIP_SMOKE_URL}/api/plugins/${PLUGIN_KEY}/data/dashboard"
}

mapping_issue_id() {
  local company_id="$1"
  local fingerprint="${2:-$FINGERPRINT}"
  dashboard_json "$company_id" \
    | node -e 'let data="";process.stdin.on("data",(chunk)=>data+=chunk);process.stdin.on("end",()=>{const body=JSON.parse(data).data;const match=(body.sourceMappings||[]).find((row)=>row.externalId===process.argv[1]);if(!match||!match.issueId){process.exit(2);}process.stdout.write(match.issueId);});' "$fingerprint"
}

mapping_hits() {
  local company_id="$1"
  local fingerprint="${2:-$FINGERPRINT}"
  dashboard_json "$company_id" \
    | node -e 'let data="";process.stdin.on("data",(chunk)=>data+=chunk);process.stdin.on("end",()=>{const body=JSON.parse(data).data;const match=(body.sourceMappings||[]).find((row)=>row.externalId===process.argv[1]);process.stdout.write(String(match?.hits ?? 0));});' "$fingerprint"
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
    "${PAPERCLIP_SMOKE_URL}/api/plugins/${PLUGIN_KEY}/webhooks/ci" >/dev/null
}

send_firestore_webhook() {
  curl -fsS -X POST \
    -H "Content-Type: application/json" \
    -d "$(node -e 'process.stdout.write(JSON.stringify({event:"request.created",collection:"inbound_requests",documentId:process.argv[1],data:{email:"smoke@blueprint.test",siteName:"Smoke Site"}}));' "$OPS_FIRESTORE_ID")" \
    "${PAPERCLIP_SMOKE_URL}/api/plugins/${PLUGIN_KEY}/webhooks/ops-firestore" >/dev/null
}

send_stripe_webhook() {
  curl -fsS -X POST \
    -H "Content-Type: application/json" \
    -d "$(node -e 'process.stdout.write(JSON.stringify({type:"payout.failed",id:process.argv[1],data:{object:{amount:12500,currency:"usd",arrival_date:"2026-03-28"}}}));' "$OPS_STRIPE_ID")" \
    "${PAPERCLIP_SMOKE_URL}/api/plugins/${PLUGIN_KEY}/webhooks/ops-stripe" >/dev/null
}

send_support_webhook() {
  curl -fsS -X POST \
    -H "Content-Type: application/json" \
    -d "$(node -e 'process.stdout.write(JSON.stringify({ticketId:process.argv[1],subject:"Smoke support ticket",from:"buyer@blueprint.test",body:"Need help with hosted session access.",source:"smoke-test",receivedAt:new Date().toISOString()}));' "$OPS_SUPPORT_ID")" \
    "${PAPERCLIP_SMOKE_URL}/api/plugins/${PLUGIN_KEY}/webhooks/ops-support" >/dev/null
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

  send_firestore_webhook
  local firestore_issue
  firestore_issue="$(mapping_issue_id "$company" "$OPS_FIRESTORE_FINGERPRINT")"

  send_stripe_webhook
  local stripe_issue
  stripe_issue="$(mapping_issue_id "$company" "$OPS_STRIPE_FINGERPRINT")"

  send_support_webhook
  local support_issue
  support_issue="$(mapping_issue_id "$company" "$OPS_SUPPORT_FINGERPRINT")"

  local blocker_issue
  blocker_issue="$(
    curl -fsS -X POST \
      -H "Content-Type: application/json" \
      -d "$(node -e 'process.stdout.write(JSON.stringify({companyId:process.argv[1],params:{companyId:process.argv[1],parentIssueId:process.argv[2],title:"Smoke blocker follow-up",description:"Smoke script created a linked blocker issue.",projectName:"blueprint-webapp",assignee:"webapp-claude",priority:"high"}}));' "$company" "$issue_id")" \
      "${PAPERCLIP_SMOKE_URL}/api/plugins/${PLUGIN_KEY}/actions/report-blocker" \
      | node -e 'let data="";process.stdin.on("data",(chunk)=>data+=chunk);process.stdin.on("end",()=>{const body=JSON.parse(data).data;process.stdout.write(body.id);});'
  )"

  curl -fsS -X POST \
    -H "Content-Type: application/json" \
    -d "$(node -e 'process.stdout.write(JSON.stringify({companyId:process.argv[1],params:{companyId:process.argv[1],sourceType:process.argv[2],sourceId:process.argv[3],resolutionStatus:"done",comment:"Smoke script resolved the CI issue."}}));' "$company" "$SOURCE_TYPE" "$SOURCE_ID")" \
    "${PAPERCLIP_SMOKE_URL}/api/plugins/${PLUGIN_KEY}/actions/resolve-work-item" >/dev/null

  local final_status
  final_status="$(
    curl -fsS "${PAPERCLIP_SMOKE_URL}/api/issues/${issue_id}" \
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
  echo "firestore issue: ${firestore_issue}"
  echo "stripe issue: ${stripe_issue}"
  echo "support issue: ${support_issue}"
}

main "$@"
