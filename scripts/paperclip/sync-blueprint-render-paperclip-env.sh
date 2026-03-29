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

RENDER_API_KEY="${BLUEPRINT_RENDER_API_KEY:-}"
RENDER_SERVICE_ID="${BLUEPRINT_RENDER_WEBAPP_SERVICE_ID:-srv-d4vnmk3e5dus73aiohk0}"
PAPERCLIP_PUBLIC_URL="${PAPERCLIP_PUBLIC_URL:-}"

if [ -z "$RENDER_API_KEY" ] || [ -z "$PAPERCLIP_PUBLIC_URL" ]; then
  exit 0
fi

STRIPE_TARGET="${PAPERCLIP_PUBLIC_URL%/}/api/plugins/blueprint.automation/webhooks/ops-stripe"
FIRESTORE_TARGET="${PAPERCLIP_PUBLIC_URL%/}/api/plugins/blueprint.automation/webhooks/ops-firestore"

update_env_var() {
  local key="$1"
  local value="$2"
  curl -fsS -X PUT \
    "https://api.render.com/v1/services/${RENDER_SERVICE_ID}/env-vars/${key}" \
    -H "Authorization: Bearer ${RENDER_API_KEY}" \
    -H "Content-Type: application/json" \
    --data "$(node -e 'process.stdout.write(JSON.stringify({value: process.argv[1]}));' "$value")" \
    >/dev/null
}

update_env_var "PAPERCLIP_OPS_STRIPE_WEBHOOK_URL" "$STRIPE_TARGET"
update_env_var "PAPERCLIP_OPS_FIRESTORE_WEBHOOK_URL" "$FIRESTORE_TARGET"

curl -fsS -X POST \
  "https://api.render.com/v1/services/${RENDER_SERVICE_ID}/restart" \
  -H "Authorization: Bearer ${RENDER_API_KEY}" \
  >/dev/null

echo "Synced Render Paperclip relay envs to ${PAPERCLIP_PUBLIC_URL}"
