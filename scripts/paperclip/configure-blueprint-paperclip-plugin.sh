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
PAPERCLIP_PUBLIC_URL="${PAPERCLIP_PUBLIC_URL:-$PAPERCLIP_API_URL}"
COMPANY_NAME="${COMPANY_NAME:-Blueprint Autonomous Operations}"
PLUGIN_KEY="blueprint.automation"
PLUGIN_DIR="/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/plugins/blueprint-automation"
CONFIG_TEMPLATE="/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/blueprint-automation.config.json"

require_health() {
  curl -fsS "${PAPERCLIP_API_URL}/api/health" >/dev/null
}

company_id() {
  curl -fsS "${PAPERCLIP_API_URL}/api/companies" \
    | node -e 'let data="";process.stdin.on("data",(chunk)=>data+=chunk);process.stdin.on("end",()=>{const rows=JSON.parse(data);const match=rows.find((row)=>row.name===process.argv[1]);if(!match){process.exit(2);}process.stdout.write(match.id);});' "$COMPANY_NAME"
}

plugin_json() {
  curl -fsS "${PAPERCLIP_API_URL}/api/plugins" \
    | node -e 'let data="";process.stdin.on("data",(chunk)=>data+=chunk);process.stdin.on("end",()=>{const rows=JSON.parse(data);const match=rows.find((row)=>row.pluginKey===process.argv[1]);if(!match){process.exit(2);}process.stdout.write(JSON.stringify(match));});' "$PLUGIN_KEY"
}

plugin_id() {
  plugin_json | node -e 'let data="";process.stdin.on("data",(chunk)=>data+=chunk);process.stdin.on("end",()=>{const row=JSON.parse(data);process.stdout.write(row.id);});'
}

secret_id_by_name() {
  local company_id="$1"
  local secret_name="$2"
  curl -fsS "${PAPERCLIP_API_URL}/api/companies/${company_id}/secrets" \
    | node -e 'let data="";process.stdin.on("data",(chunk)=>data+=chunk);process.stdin.on("end",()=>{const rows=JSON.parse(data);const match=rows.find((row)=>row.name===process.argv[1]);process.stdout.write(match?match.id:"");});' "$secret_name"
}

upsert_secret_from_env() {
  local company_id="$1"
  local secret_name="$2"
  local env_var="$3"
  local value="${!env_var:-}"

  if [ -z "$value" ]; then
    # No env var set — return existing secret ID if one exists
    local existing_id
    existing_id="$(secret_id_by_name "$company_id" "$secret_name")"
    printf '%s' "$existing_id"
    return 0
  fi

  local existing_id
  existing_id="$(secret_id_by_name "$company_id" "$secret_name")"

  if [ -n "$existing_id" ]; then
    curl -fsS -X POST \
      -H "Content-Type: application/json" \
      -d "$(node -e 'process.stdout.write(JSON.stringify({value:process.argv[1]}));' "$value")" \
      "${PAPERCLIP_API_URL}/api/secrets/${existing_id}/rotate" >/dev/null
    printf '%s' "$existing_id"
    return 0
  fi

  curl -fsS -X POST \
    -H "Content-Type: application/json" \
    -d "$(node -e 'process.stdout.write(JSON.stringify({name:process.argv[1],value:process.argv[2],provider:"local_encrypted"}));' "$secret_name" "$value")" \
    "${PAPERCLIP_API_URL}/api/companies/${company_id}/secrets" \
    | node -e 'let data="";process.stdin.on("data",(chunk)=>data+=chunk);process.stdin.on("end",()=>{const row=JSON.parse(data);process.stdout.write(row.id);});'
}

ensure_plugin_build() {
  (cd "$PLUGIN_DIR" && npm install >/dev/null && npm run build >/dev/null)
}

ensure_plugin_installed() {
  local plugin_record=""
  if plugin_record="$(plugin_json 2>/dev/null)"; then
    local plugin_id
    local status
    plugin_id="$(printf '%s' "$plugin_record" | node -e 'let data="";process.stdin.on("data",(chunk)=>data+=chunk);process.stdin.on("end",()=>{const row=JSON.parse(data);process.stdout.write(row.id);});')"
    curl -fsS -X POST "${PAPERCLIP_API_URL}/api/plugins/${plugin_id}/upgrade" >/dev/null || true
    status="$(printf '%s' "$plugin_record" | node -e 'let data="";process.stdin.on("data",(chunk)=>data+=chunk);process.stdin.on("end",()=>{const row=JSON.parse(data);process.stdout.write(row.status);});')"
    if [ "$status" != "ready" ]; then
      curl -fsS -X POST "${PAPERCLIP_API_URL}/api/plugins/${plugin_id}/enable" >/dev/null || true
    fi
    return 0
  fi

  curl -fsS -X POST \
    -H "Content-Type: application/json" \
    -d "$(node -e 'process.stdout.write(JSON.stringify({packageName:process.argv[1],isLocalPath:true}));' "$PLUGIN_DIR")" \
    "${PAPERCLIP_API_URL}/api/plugins/install" >/dev/null
}

write_plugin_config() {
  local company_id="$1"
  local github_token_id="$2"
  local github_webhook_secret_id="$3"
  local ci_secret_id="$4"
  local intake_secret_id="$5"
  local plugin_id="$6"
  local notification_webhook_id="${7:-}"
  local notion_token_id="${8:-}"
  local slack_ops_webhook_id="${9:-}"
  local slack_growth_webhook_id="${10:-}"
  local search_api_key_id="${11:-}"
  local search_api_provider_id="${12:-}"

  local payload
  payload="$(
    node -e '
      const fs = require("fs");
      const template = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
      template.companyName = process.argv[2];
      if (process.argv[3]) template.githubOwner = process.argv[3];
      if (process.argv[4]) template.githubTokenRef = process.argv[4];
      if (process.argv[5]) template.githubWebhookSecretRef = process.argv[5];
      if (process.argv[6]) template.ciSharedSecretRef = process.argv[6];
      if (process.argv[7]) template.intakeSharedSecretRef = process.argv[7];
      if (process.argv[8]) template.notificationWebhookUrlRef = process.argv[8];
      template.secrets = template.secrets || {};
      template.secrets.notionApiTokenRef = process.argv[9] || "";
      template.secrets.slackOpsWebhookUrlRef = process.argv[10] || "";
      template.secrets.slackGrowthWebhookUrlRef = process.argv[11] || "";
      template.secrets.searchApiKeyRef = process.argv[12] || "";
      template.secrets.searchApiProviderRef = process.argv[13] || "";
      template.enableOutboundNotifications = Boolean(process.argv[8]);
      process.stdout.write(JSON.stringify({configJson: template}));
    ' "$CONFIG_TEMPLATE" "$COMPANY_NAME" "${BLUEPRINT_PAPERCLIP_GITHUB_OWNER:-}" "$github_token_id" "$github_webhook_secret_id" "$ci_secret_id" "$intake_secret_id" "$notification_webhook_id" "$notion_token_id" "$slack_ops_webhook_id" "$slack_growth_webhook_id" "$search_api_key_id" "$search_api_provider_id"
  )"

  curl -fsS -X POST \
    -H "Content-Type: application/json" \
    -d "$payload" \
    "${PAPERCLIP_API_URL}/api/plugins/${plugin_id}/config" >/dev/null
}

main() {
  require_health
  ensure_plugin_build

  local company
  company="$(company_id)"

  ensure_plugin_installed
  local plugin
  plugin="$(plugin_id)"

  local github_token_id
  local github_webhook_secret_id
  local ci_secret_id
  local intake_secret_id
  local notification_webhook_id
  local notion_token_id
  local slack_ops_webhook_id
  local slack_growth_webhook_id
  local search_api_key_id
  local search_api_provider_id

  github_token_id="$(upsert_secret_from_env "$company" "github-token" "BLUEPRINT_PAPERCLIP_GITHUB_TOKEN")"
  github_webhook_secret_id="$(upsert_secret_from_env "$company" "github-webhook-secret" "BLUEPRINT_PAPERCLIP_GITHUB_WEBHOOK_SECRET")"
  ci_secret_id="$(upsert_secret_from_env "$company" "ci-shared-secret" "BLUEPRINT_PAPERCLIP_CI_SHARED_SECRET")"
  intake_secret_id="$(upsert_secret_from_env "$company" "intake-shared-secret" "BLUEPRINT_PAPERCLIP_INTAKE_SHARED_SECRET")"
  notification_webhook_id="$(upsert_secret_from_env "$company" "notification-webhook-url" "BLUEPRINT_PAPERCLIP_NOTIFICATION_WEBHOOK_URL")"
  notion_token_id="$(upsert_secret_from_env "$company" "notion-api-token" "NOTION_API_TOKEN")"
  slack_ops_webhook_id="$(upsert_secret_from_env "$company" "slack-ops-webhook-url" "SLACK_OPS_WEBHOOK_URL")"
  slack_growth_webhook_id="$(upsert_secret_from_env "$company" "slack-growth-webhook-url" "SLACK_GROWTH_WEBHOOK_URL")"
  search_api_key_id="$(upsert_secret_from_env "$company" "search-api-key" "SEARCH_API_KEY")"
  search_api_provider_id="$(upsert_secret_from_env "$company" "search-api-provider" "SEARCH_API_PROVIDER")"

  write_plugin_config \
    "$company" \
    "$github_token_id" \
    "$github_webhook_secret_id" \
    "$ci_secret_id" \
    "$intake_secret_id" \
    "$plugin" \
    "$notification_webhook_id" \
    "$notion_token_id" \
    "$slack_ops_webhook_id" \
    "$slack_growth_webhook_id" \
    "$search_api_key_id" \
    "$search_api_provider_id"

  curl -fsS "${PAPERCLIP_API_URL}/api/plugins/${plugin}/health" >/dev/null

  echo "Configured Blueprint plugin ${PLUGIN_KEY}"
  echo "plugin id: ${plugin}"
  echo "github webhook: ${PAPERCLIP_PUBLIC_URL}/api/plugins/${PLUGIN_KEY}/webhooks/github"
  echo "generic ci webhook: ${PAPERCLIP_PUBLIC_URL}/api/plugins/${PLUGIN_KEY}/webhooks/ci"
  echo "operator intake webhook: ${PAPERCLIP_PUBLIC_URL}/api/plugins/${PLUGIN_KEY}/webhooks/intake"
  echo "ops firestore webhook: ${PAPERCLIP_PUBLIC_URL}/api/plugins/${PLUGIN_KEY}/webhooks/ops-firestore"
  echo "ops stripe webhook: ${PAPERCLIP_PUBLIC_URL}/api/plugins/${PLUGIN_KEY}/webhooks/ops-stripe"
  echo "ops support webhook: ${PAPERCLIP_PUBLIC_URL}/api/plugins/${PLUGIN_KEY}/webhooks/ops-support"
}

main "$@"
