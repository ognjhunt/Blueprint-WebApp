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

export PATH="/opt/homebrew/bin:/Users/nijelhunt_1/.nvm/versions/node/v22.21.1/bin:$PATH"

PAPERCLIP_PUBLIC_URL="${PAPERCLIP_PUBLIC_URL:?Set PAPERCLIP_PUBLIC_URL to a public Paperclip URL first}"
GITHUB_OWNER="${BLUEPRINT_PAPERCLIP_GITHUB_OWNER:-ognjhunt}"
WEBHOOK_SECRET="${BLUEPRINT_PAPERCLIP_GITHUB_WEBHOOK_SECRET:-}"
WEBHOOK_URL="${PAPERCLIP_PUBLIC_URL}/api/plugins/blueprint.automation/webhooks/github"
REPOS=("Blueprint-WebApp" "BlueprintCapturePipeline" "BlueprintCapture")

case "$PAPERCLIP_PUBLIC_URL" in
  http://127.0.0.1:*|http://localhost:*|https://127.0.0.1:*|https://localhost:*)
    echo "PAPERCLIP_PUBLIC_URL must be publicly reachable for GitHub webhooks: $PAPERCLIP_PUBLIC_URL" >&2
    exit 1
    ;;
esac

[ -n "$WEBHOOK_SECRET" ] || { echo "BLUEPRINT_PAPERCLIP_GITHUB_WEBHOOK_SECRET is required" >&2; exit 1; }
command -v gh >/dev/null 2>&1 || { echo "gh CLI is required" >&2; exit 1; }
gh auth status >/dev/null

echo "Webhook URL: $WEBHOOK_URL"
echo "GitHub owner: $GITHUB_OWNER"
echo ""

create_or_update_hook() {
  local repo="$1"
  local existing_id
  existing_id="$(gh api "repos/$GITHUB_OWNER/$repo/hooks" --jq ".[] | select(.config.url == \"$WEBHOOK_URL\") | .id" 2>/dev/null || true)"

  if [ -n "$existing_id" ]; then
    gh api "repos/$GITHUB_OWNER/$repo/hooks/$existing_id" \
      --method PATCH \
      --field "config[url]=$WEBHOOK_URL" \
      --field "config[content_type]=json" \
      --field "config[secret]=$WEBHOOK_SECRET" \
      --field "events[]=pull_request_review" \
      --field "events[]=workflow_run" \
      --field "active=true" \
      --silent
    printf '%s' "$existing_id"
    return 0
  fi

  gh api "repos/$GITHUB_OWNER/$repo/hooks" \
    --method POST \
    --field "name=web" \
    --field "config[url]=$WEBHOOK_URL" \
    --field "config[content_type]=json" \
    --field "config[secret]=$WEBHOOK_SECRET" \
    --field "events[]=pull_request_review" \
    --field "events[]=workflow_run" \
    --field "active=true" \
    --jq '.id'
}

validate_hook() {
  local repo="$1"
  local hook_id="$2"
  gh api "repos/$GITHUB_OWNER/$repo/hooks/$hook_id/pings" --method POST --silent

  local delivery=""
  for _ in $(seq 1 10); do
    delivery="$(gh api "repos/$GITHUB_OWNER/$repo/hooks/$hook_id/deliveries?per_page=5" --jq 'map(select(.event == "ping")) | sort_by(.delivered_at // .id) | reverse | .[0]')"
    if [ -n "$delivery" ] && [ "$delivery" != "null" ]; then
      break
    fi
    sleep 2
  done

  [ -n "$delivery" ] && [ "$delivery" != "null" ] || {
    echo "  No ping delivery found for $repo" >&2
    return 1
  }

  local code
  local status
  code="$(printf '%s' "$delivery" | jq -r '.status_code // .response.status_code // empty')"
  status="$(printf '%s' "$delivery" | jq -r '.status // .state // empty')"
  echo "  Latest ping delivery: status=${status:-unknown} code=${code:-unknown}"

  if [ -n "$code" ] && [ "$code" != "200" ] && [ "$code" != "202" ]; then
    echo "  Ping delivery failed for $repo" >&2
    return 1
  fi
}

for repo in "${REPOS[@]}"; do
  echo "--- $GITHUB_OWNER/$repo ---"
  hook_id="$(create_or_update_hook "$repo")"
  echo "  Hook id: $hook_id"
  validate_hook "$repo" "$hook_id"
done

echo ""
echo "GitHub webhooks configured and ping-validated."
